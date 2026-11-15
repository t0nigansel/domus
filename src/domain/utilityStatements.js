import { validDate } from "./rentals.js";

const day = (value) =>
  Date.parse(`${validDate(value, "Datum")}T00:00:00Z`) / 86400000;
const iso = (value) => new Date(value * 86400000).toISOString().slice(0, 10);
export const ALLOCATION_KEYS = {
  area: "Wohnfläche",
  units: "Einheiten",
  personDays: "Personentage",
  consumption: "Verbrauch",
  fixed: "Feste Anteile",
};
export function signedCents(value) {
  const text = String(value ?? "").replace(",", ".");
  if (!/^-?\d{1,9}(\.\d{1,2})?$/.test(text))
    throw new Error(
      "Bitte einen gültigen Betrag mit höchstens zwei Nachkommastellen angeben.",
    );
  const [whole, decimals = ""] = text.replace("-", "").split(".");
  return (
    (Number(whole) * 100 + Number(decimals.padEnd(2, "0"))) *
    (text.startsWith("-") ? -1 : 1)
  );
}
export function distributeCents(total, entries) {
  if (
    !Number.isSafeInteger(total) ||
    !entries.length ||
    entries.some(
      (entry) => !Number.isSafeInteger(entry.weight) || entry.weight < 0,
    )
  )
    throw new Error("Ungültige Verteilung.");
  const sum = entries.reduce(
    (value, entry) => value + BigInt(entry.weight),
    0n,
  );
  if (!sum) throw new Error("Der Verteilerschlüssel ergibt insgesamt null.");
  const absolute = BigInt(Math.abs(total));
  const parts = entries.map((entry) => ({
    id: entry.id,
    cents: Number((absolute * BigInt(entry.weight)) / sum),
    remainder: (absolute * BigInt(entry.weight)) % sum,
  }));
  const remaining =
    Math.abs(total) - parts.reduce((value, entry) => value + entry.cents, 0);
  const ranked = [...parts].sort((a, b) =>
    a.remainder === b.remainder
      ? a.id.localeCompare(b.id, "en")
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (let index = 0; index < remaining; index++) ranked[index].cents++;
  return Object.fromEntries(
    parts.map((entry) => [entry.id, entry.cents * Math.sign(total)]),
  );
}
export function statementUnits(properties, leases, tenants, start, end) {
  const first = day(start),
    last = day(end);
  if (last < first) throw new Error("Das Ende liegt vor dem Beginn.");
  return properties.map((property) => {
    let cursor = first;
    const periods = [];
    const occupied = leases
      .filter(
        (lease) =>
          lease.propertyId === property.id &&
          day(lease.start) <= last &&
          (!lease.end || day(lease.end) >= first),
      )
      .sort((a, b) => a.start.localeCompare(b.start));
    for (const lease of occupied) {
      const from = Math.max(first, day(lease.start)),
        to = Math.min(last, lease.end ? day(lease.end) : last);
      if (from < cursor)
        throw new Error(
          "Überlappende Mietverhältnisse. Bitte zuerst korrigieren.",
        );
      if (from > cursor)
        periods.push({
          id: `${property.id}:owner:${cursor}`,
          owner: true,
          name: "Eigentümer / Leerstand",
          start: iso(cursor),
          end: iso(from - 1),
          personCount: "",
          confirmed: false,
        });
      periods.push({
        id: lease.id,
        leaseId: lease.id,
        name: lease.tenantIds
          .map(
            (id) =>
              tenants.find((tenant) => tenant.id === id)?.name ||
              "Vertragspartei",
          )
          .join(" & "),
        tenantIds: lease.tenantIds,
        start: iso(from),
        end: iso(to),
        personCount: "",
        confirmed: false,
      });
      cursor = to + 1;
    }
    if (cursor <= last)
      periods.push({
        id: `${property.id}:owner:${cursor}`,
        owner: true,
        name: "Eigentümer / Leerstand",
        start: iso(cursor),
        end,
        personCount: "",
        confirmed: false,
      });
    return {
      id: property.id,
      name: property.name,
      area: property.size ?? "",
      confirmed: false,
      periods,
    };
  });
}
export function calculateStatement(statement) {
  const issues = [];
  const shares = {};
  const units = statement.units || [];
  const periods = units.flatMap((unit) =>
    unit.periods.map((period) => ({ ...period, unit })),
  );
  const result = periods.map((period) => ({
    periodId: period.id,
    leaseId: period.leaseId,
    owner: !!period.owner,
    unitId: period.unit.id,
    unit: period.unit.name,
    name: period.name,
    start: period.start,
    end: period.end,
    lines: [],
    totalCents: 0,
    advanceCents: 0,
  }));
  const issue = (message) => issues.push(message);
  try {
    if (day(statement.end) < day(statement.start))
      issue("Ungültiger Abrechnungszeitraum.");
    if (!units.length) issue("Dem Haus sind noch keine Wohnungen zugeordnet.");
    if (!statement.houseConfirmed)
      issue("Vollständigkeit der Wohnungen und Vertragsgrundlagen bestätigen.");
    if (!statement.heatingConfirmed)
      issue(
        "Heizkostenabrechnung beziehungsweise nicht anfallende Heizkosten bestätigen.",
      );
    if (!statement.advancesConfirmed)
      issue("Vollständigkeit der tatsächlichen Vorauszahlungen bestätigen.");
    for (const doc of statement.documents || [])
      if (
        !["checked", "excluded"].includes(doc.status) ||
        (doc.status === "excluded" && !doc.reason?.trim())
      )
        issue(`Beleg prüfen: ${doc.name}`);
    for (const unit of units) {
      if (!unit.confirmed)
        issue(`Historische Wohnungsdaten bestätigen: ${unit.name}`);
      for (const period of unit.periods)
        if (!period.confirmed)
          issue(
            `Mietzeitraum und Empfänger bestätigen: ${unit.name} · ${period.name}`,
          );
    }
    if (!statement.items?.length && !statement.heating?.length)
      issue("Keine Kostenpositionen erfasst.");
    const invoices = new Set();
    for (const item of statement.items || []) {
      if (item.excluded) {
        if (!item.reason?.trim()) issue(`Ausschluss begründen: ${item.name}`);
        continue;
      }
      if (
        !item.confirmed ||
        !item.category?.trim() ||
        !item.documentId ||
        !item.page?.trim() ||
        !item.contractBasis?.trim() ||
        !item.reference?.trim()
      )
        issue(`Kostenart, Vertragsgrundlage und Beleg prüfen: ${item.name}`);
      const reference = `${String(item.reference || item.id)
        .trim()
        .toLowerCase()}:${signedCents(item.amount)}`;
      if (invoices.has(reference))
        issue(`Möglicherweise doppelte Position: ${item.name}`);
      invoices.add(reference);
      const from = Math.max(day(statement.start), day(item.start)),
        to = Math.min(day(statement.end), day(item.end));
      const serviceDays = day(item.end) - day(item.start) + 1;
      if (serviceDays <= 0 || from > to)
        throw new Error(`Leistungszeitraum prüfen: ${item.name}`);
      const amount = signedCents(item.amount);
      const cents =
        Math.sign(amount) *
        Math.round((Math.abs(amount) * (to - from + 1)) / serviceDays);
      const weights = periods.map((period) => {
        const days = Math.max(
          0,
          Math.min(day(period.end), to) - Math.max(day(period.start), from) + 1,
        );
        let weight;
        if (item.allocation === "area") {
          if (
            period.unit.area === "" ||
            !Number.isFinite(Number(period.unit.area)) ||
            Number(period.unit.area) <= 0
          )
            throw new Error(`Wohnfläche fehlt: ${period.unit.name}`);
          weight = Math.round(Number(period.unit.area) * 10000) * days;
        } else if (item.allocation === "units") weight = days;
        else if (item.allocation === "personDays") {
          if (
            !period.occupancy?.length &&
            (period.personCount === "" ||
              !Number.isInteger(Number(period.personCount)) ||
              Number(period.personCount) < 0)
          )
            throw new Error(
              `Personenzahl fehlt: ${period.unit.name} · ${period.name}`,
            );
          weight = Number(period.personCount) * days;
          if (period.occupancy?.length) {
            const segments = [...period.occupancy].sort((a, b) =>
              a.start.localeCompare(b.start),
            );
            let cursor = day(period.start);
            weight = 0;
            for (const segment of segments) {
              const segmentStart = day(segment.start),
                segmentEnd = day(segment.end);
              if (
                segmentStart !== cursor ||
                segmentEnd < segmentStart ||
                segmentEnd > day(period.end) ||
                segment.count === "" ||
                !Number.isInteger(Number(segment.count)) ||
                Number(segment.count) < 0
              )
                throw new Error(
                  `Personenzahl-Verlauf unvollständig: ${period.unit.name}`,
                );
              weight +=
                Math.max(
                  0,
                  Math.min(segmentEnd, to) - Math.max(segmentStart, from) + 1,
                ) * Number(segment.count);
              cursor = segmentEnd + 1;
            }
            if (cursor !== day(period.end) + 1)
              throw new Error(
                `Personenzahl-Verlauf unvollständig: ${period.unit.name}`,
              );
          }
        } else if (["consumption", "fixed"].includes(item.allocation)) {
          const raw = item.weights?.[period.id];
          if (
            days &&
            (raw === undefined ||
              raw === "" ||
              !Number.isFinite(Number(raw)) ||
              Number(raw) < 0)
          )
            throw new Error(
              `Anteil fehlt: ${item.name} · ${period.unit.name} · ${period.name}`,
            );
          weight = days ? Math.round(Number(raw) * 10000) : 0;
        } else throw new Error(`Verteilerschlüssel fehlt: ${item.name}`);
        return { id: period.id, weight };
      });
      const allocated = distributeCents(cents, weights);
      shares[item.id] = allocated;
      for (const row of result) {
        row.lines.push({
          name: item.name,
          category: item.category,
          totalCents: amount,
          periodCents: cents,
          allocation: item.allocation,
          numerator: weights.find((weight) => weight.id === row.periodId)
            .weight,
          denominator: weights.reduce((sum, weight) => sum + weight.weight, 0),
          cents: allocated[row.periodId],
          documentId: item.documentId,
          page: item.page,
          start: item.start,
          end: item.end,
        });
        row.totalCents += allocated[row.periodId];
      }
    }
    for (const heating of statement.heating || []) {
      const row = result.find((row) => row.periodId === heating.periodId);
      if (
        !row ||
        !heating.confirmed ||
        !heating.documentId ||
        !heating.page?.trim()
      ) {
        issue("Externe Heizkostenposition prüfen.");
        continue;
      }
      const cents = signedCents(heating.amount);
      row.lines.push({
        name: "Heizung / Warmwasser (externe Abrechnung)",
        cents,
        documentId: heating.documentId,
        page: heating.page,
      });
      row.totalCents += cents;
    }
    for (const advance of statement.advances || []) {
      const row = result.find((row) => row.leaseId === advance.leaseId);
      if (
        !row ||
        !advance.confirmed ||
        !advance.reference?.trim() ||
        day(advance.date) < day(row.start) ||
        day(advance.date) > day(row.end)
      ) {
        issue("Vorauszahlung, Zahlungsdatum oder Nachweis prüfen.");
        continue;
      }
      row.advanceCents += signedCents(advance.amount);
    }
  } catch (error) {
    issue(error.message);
  }
  return {
    issues: [...new Set(issues)],
    shares,
    rows: result.map((row) => ({
      ...row,
      balanceCents: row.totalCents - row.advanceCents,
    })),
  };
}
