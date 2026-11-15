import { rentalError, validDate } from "../../src/domain/rentals.js";
import { randomUUID } from "node:crypto";
import {
  signedCents,
  statementUnits,
  ALLOCATION_KEYS,
} from "../../src/domain/utilityStatements.js";

export function text(value, max = 2000) {
  if (typeof value !== "string" || value.length > max)
    throw rentalError("Ungültiger Text oder zu viele Zeichen.");
  return value.trim();
}
export function list(value, max = 500) {
  if (!Array.isArray(value) || value.length > max)
    throw rentalError("Ungültige oder zu große Liste.");
  return value;
}
const flag = (value) => value === true;
export function buildingInput(input) {
  const result = Object.fromEntries(
    [
      "name",
      "street",
      "postalCode",
      "city",
      "description",
      "equipment",
      "energy",
      "year",
    ].map((key) => [
      key,
      text(input[key] || "", key === "description" ? 10000 : 2000),
    ]),
  );
  if (!result.name) throw rentalError("Bitte eine Hausbezeichnung angeben.");
  return result;
}
export function settingsInput(input) {
  if (
    !["light", "dark", "system"].includes(input.appearance) ||
    !["de", "en"].includes(input.language) ||
    !["", "openai", "anthropic", "google"].includes(input.provider || "")
  )
    throw rentalError("Ungültige Einstellung.");
  const sender = Object.fromEntries(
    ["name", "address", "email", "phone", "logoId"].map((key) => [
      key,
      text(input.sender?.[key] || ""),
    ]),
  );
  return {
    appearance: input.appearance,
    language: input.language,
    provider: input.provider || "",
    sender,
  };
}
export function exposeInput(input, previous, data) {
  const property = data.properties.find(
    (property) => property.id === (previous?.propertyId || input.propertyId),
  );
  if (!property) throw rentalError("Wohnung nicht gefunden.", 404);
  const documents = list(
    input.documentIds || previous?.documentIds || [],
    12,
  ).map((id) => {
    const doc = data.documents.find(
      (doc) =>
        doc.id === id &&
        doc.propertyId === property.id &&
        doc.hasFile &&
        ["Photos", "FloorPlans", "Energy"].includes(doc.category),
    );
    if (
      !doc ||
      (["Photos", "FloorPlans"].includes(doc.category) && !doc.published)
    )
      throw rentalError(
        "Nur ausdrücklich freigegebene Objektbilder und Energieunterlagen auswählen.",
      );
    return doc.id;
  });
  const fields = Object.fromEntries(
    [
      "title",
      "intro",
      "features",
      "building",
      "location",
      "terms",
      "contact",
    ].map((key) => [key, text(input[key] ?? previous?.[key] ?? "", 20000)]),
  );
  return {
    ...previous,
    ...fields,
    propertyId: property.id,
    buildingId: property.buildingId || null,
    documentIds: documents,
    availableFrom:
      validDate(
        input.availableFrom ?? previous?.availableFrom ?? "",
        "Verfügbar ab",
        true,
      ) || "",
    reviewed: flag(input.reviewed),
    warnings: input.resolvedWarnings === true ? [] : previous?.warnings || [],
    status: "draft",
  };
}
export function newStatement(input, data, building) {
  const start = validDate(input.start, "Abrechnungsbeginn"),
    end = validDate(input.end, "Abrechnungsende");
  if (end < start || Date.parse(end) - Date.parse(start) > 366 * 86400000)
    throw rentalError(
      "Bitte einen Zeitraum von höchstens einem Jahr auswählen.",
    );
  const properties = data.properties.filter(
    (property) => property.buildingId === building.id,
  );
  if (!properties.length)
    throw rentalError("Bitte zuerst Wohnungen dem Haus zuordnen.");
  const ids = new Set(properties.map((property) => property.id));
  const documents = data.documents
    .filter(
      (doc) =>
        doc.hasFile &&
        (doc.buildingId === building.id || ids.has(doc.propertyId)) &&
        !["Exposes", "Statements"].includes(doc.category),
    )
    .map((doc) => ({
      id: doc.id,
      name: doc.name,
      status: ["Photos", "FloorPlans"].includes(doc.category)
        ? "excluded"
        : "pending",
      reason: ["Photos", "FloorPlans"].includes(doc.category)
        ? "Objektbild / Grundriss"
        : "",
    }));
  return {
    buildingId: building.id,
    building: structuredClone(building),
    start,
    end,
    status: "draft",
    documents,
    units: statementUnits(properties, data.leases, data.tenants, start, end),
    items: [],
    advances: [],
    heating: [],
    costCandidates: data.costs.filter(
      (cost) =>
        cost.buildingId === building.id ||
        cost.propertyIds?.some((id) => ids.has(id)),
    ),
    houseConfirmed: false,
    advancesConfirmed: false,
    heatingConfirmed: false,
  };
}
export function statementInput(input, previous, data) {
  const documents = previous.documents.map((doc) => {
    const update = input.documents?.find((item) => item.id === doc.id) || doc;
    if (!["checked", "excluded", "pending"].includes(update.status))
      throw rentalError("Ungültiger Belegstatus.");
    return { ...doc, status: update.status, reason: text(update.reason || "") };
  });
  const units = previous.units.map((unit) => {
    const update = input.units?.find((item) => item.id === unit.id) || unit;
    const area = update.area === "" ? "" : Number(update.area);
    if (area !== "" && (!Number.isFinite(area) || area <= 0 || area > 100000))
      throw rentalError("Ungültige Wohnfläche.");
    return {
      ...unit,
      area,
      confirmed: flag(update.confirmed),
      periods: unit.periods.map((period) => {
        const value =
          update.periods?.find((item) => item.id === period.id) || period;
        const rawPersonCount = value.personCount ?? period.personCount ?? "";
        const personCount = rawPersonCount === "" ? "" : Number(rawPersonCount);
        if (
          personCount !== "" &&
          (!Number.isInteger(personCount) ||
            personCount < 0 ||
            personCount > 10000)
        )
          throw rentalError("Ungültige Personenzahl.");
        const occupancy = list(value.occupancy || [], 100).map((segment) => {
          const count = Number(segment.count);
          if (
            segment.count === "" ||
            !Number.isInteger(count) ||
            count < 0 ||
            count > 10000
          )
            throw rentalError("Ungültige Personenzahl.");
          return {
            start: validDate(segment.start, "Beginn"),
            end: validDate(segment.end, "Ende"),
            count,
          };
        });
        return {
          ...period,
          personCount,
          occupancy,
          confirmed: flag(value.confirmed),
        };
      }),
    };
  });
  const checkDoc = (id) => {
    if (
      !data.documents.some(
        (doc) =>
          doc.id === id &&
          doc.hasFile &&
          documents.some((candidate) => candidate.id === id),
      )
    )
      throw rentalError("Beleg nicht im Abrechnungslauf vorhanden.");
    return id;
  };
  const items = list(input.items || []).map((item) => {
    signedCents(item.amount);
    if (!Object.hasOwn(ALLOCATION_KEYS, item.allocation))
      throw rentalError("Ungültiger Verteilerschlüssel.");
    const weights = Object.fromEntries(
      units
        .flatMap((unit) => unit.periods)
        .map((period) => {
          const value = item.weights?.[period.id] ?? "";
          if (
            value !== "" &&
            (!Number.isFinite(Number(value)) ||
              Number(value) < 0 ||
              Number(value) > 1e9)
          )
            throw rentalError("Ungültiger Verteilungsanteil.");
          return [period.id, value];
        }),
    );
    const existing = previous.items?.find((row) => row.id === item.id);
    return {
      id: existing?.id || randomUUID(),
      analysisJob: existing?.analysisJob,
      name: text(item.name),
      category: text(item.category || ""),
      amount: String(item.amount),
      start: validDate(item.start, "Leistungsbeginn", true) || "",
      end: validDate(item.end, "Leistungsende", true) || "",
      allocation: item.allocation,
      documentId: item.documentId ? checkDoc(item.documentId) : "",
      page: text(item.page || ""),
      contractBasis: text(item.contractBasis || ""),
      reference: text(item.reference || ""),
      confirmed: flag(item.confirmed),
      excluded: flag(item.excluded),
      reason: text(item.reason || ""),
      weights,
    };
  });
  const advances = list(input.advances || []).map((item, index) => {
    signedCents(item.amount);
    if (
      !units.some((unit) =>
        unit.periods.some((period) => period.leaseId === item.leaseId),
      )
    )
      throw rentalError("Mietverhältnis nicht im Zeitraum vorhanden.");
    return {
      id: `advance-${index}`,
      leaseId: item.leaseId,
      date: validDate(item.date, "Zahlungsdatum"),
      amount: String(item.amount),
      reference: text(item.reference || ""),
      confirmed: flag(item.confirmed),
    };
  });
  const heating = list(input.heating || []).map((item) => {
    signedCents(item.amount);
    if (
      !units.some((unit) =>
        unit.periods.some((period) => period.id === item.periodId),
      )
    )
      throw rentalError("Empfänger nicht gefunden.");
    return {
      periodId: item.periodId,
      amount: String(item.amount),
      documentId: item.documentId ? checkDoc(item.documentId) : "",
      page: text(item.page || ""),
      confirmed: flag(item.confirmed),
    };
  });
  return {
    ...previous,
    documents,
    units,
    items,
    advances,
    heating,
    houseConfirmed: flag(input.houseConfirmed),
    heatingConfirmed: flag(input.heatingConfirmed),
    advancesConfirmed: flag(input.advancesConfirmed),
  };
}
