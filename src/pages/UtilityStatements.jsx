import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useAssistant, useRecordJob } from "../hooks/useAssistant";
import { api } from "../utils/api";
import { fileService } from "../db/services/fileService";
import {
  ALLOCATION_KEYS,
  calculateStatement,
} from "../domain/utilityStatements";
import {
  AssistantField as Field,
  AssistantCheck as Check,
  JobStatus,
} from "../components/AssistantCommon";

const euros = (value) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    value / 100,
  );
export default function UtilityStatements() {
  const { id } = useParams(),
    { t } = useTranslation(),
    state = useAssistant("/utility-statements"),
    building = useAssistant(`/buildings/${id}`);
  const year = new Date().getFullYear() - 1;
  const [start, setStart] = useState(`${year}-01-01`),
    [end, setEnd] = useState(`${year}-12-31`),
    [selected, setSelected] = useState("");
  return (
    <div className="page-container assistant-page">
      <Link to={`/buildings/${id}`}>{t("← Zum Haus")}</Link>
      <h1>
        {t("Nebenkostenabrechnungen")} · {building.data?.name}
      </h1>
      {state.error && (
        <p role="alert" className="assistant-error">
          {state.error}
        </p>
      )}
      <form
        className="assistant-card"
        onSubmit={(event) => {
          event.preventDefault();
          state.run(async () => {
            const record = await api.post("/utility-statements", {
              buildingId: id,
              start,
              end,
            });
            await state.refresh();
            setSelected(record.id);
          });
        }}
      >
        <div className="assistant-grid">
          <Field
            label="Abrechnungsbeginn"
            type="date"
            required
            value={start}
            onChange={setStart}
          />
          <Field
            label="Abrechnungsende"
            type="date"
            required
            min={start}
            value={end}
            onChange={setEnd}
          />
        </div>
        <button className="btn-primary" disabled={state.busy}>
          {t("Abrechnung anlegen")}
        </button>
      </form>
      {(state.data || [])
        .filter((record) => record.buildingId === id)
        .map((record) => (
          <section className="assistant-card" key={record.id}>
            <button
              className="btn-outline"
              onClick={() =>
                setSelected(record.id === selected ? "" : record.id)
              }
            >
              {record.start} – {record.end} ·{" "}
              {t(record.status === "final" ? "Finalisiert" : "Entwurf")}
            </button>
            {record.id === selected && (
              <StatementEditor
                key={`${record.id}:${record.revision}`}
                record={record}
                onReload={state.refresh}
              />
            )}
          </section>
        ))}
    </div>
  );
}
function StatementEditor({ record, onReload }) {
  const { t } = useTranslation(),
    state = useAssistant("", false),
    [form, setForm] = useState(record),
    [consent, setConsent] = useState(false);
  const { job, setJob, working, setWorking } = useRecordJob(record.id);
  const set = (key, value) => setForm({ ...form, [key]: value });
  const rows = form.units.flatMap((unit) =>
    unit.periods.map((period) => ({ ...period, unit: unit.name })),
  );
  const calculation = calculateStatement(form);
  const update = (key, index, values) =>
    set(
      key,
      form[key].map((row, position) =>
        position === index ? { ...row, ...values } : row,
      ),
    );
  const save = async () => {
    const saved = await api.put(`/utility-statements/${record.id}`, form);
    setForm(saved);
    return saved;
  };
  const launch = async (action) => {
    if (record.status !== "final") await save();
    const result = await api.post(
      `/utility-statements/${record.id}/${action}`,
      { requestKey: crypto.randomUUID(), consent },
    );
    setJob(result.id);
    setWorking(true);
  };
  return (
    <div>
      {state.error && (
        <p role="alert" className="assistant-error">
          {state.error}
        </p>
      )}
      {record.simulated && (
        <p className="assistant-notice">
          {t(
            "Simulation: Alle Belege müssen manuell geprüft werden. Die PDFs werden als Simulation gekennzeichnet.",
          )}
        </p>
      )}
      {job && (
        <JobStatus
          id={job}
          onComplete={onReload}
          onSettled={() => setWorking(false)}
        />
      )}
      {record.status === "final" ? (
        <>
          <p>
            {t(
              "Diese Abrechnung ist finalisiert. Änderungen erfolgen in einer neuen Version.",
            )}
          </p>
          <div className="assistant-actions">
            {record.pdfIds?.map((id, index) => (
              <a key={id} className="btn-outline" href={fileService.url(id)}>
                {t("PDF herunterladen")} {index + 1}
              </a>
            ))}
            <button
              className="btn-outline"
              disabled={working || state.busy}
              onClick={() => state.run(() => launch("zip"))}
            >
              {t("Alle PDFs als ZIP")}
            </button>
            <button
              className="btn-outline"
              disabled={state.busy}
              onClick={() =>
                state.run(async () => {
                  await api.post(`/utility-statements/${record.id}/copy`, {});
                  await onReload();
                })
              }
            >
              {t("Korrekturversion anlegen")}
            </button>
          </div>
          <Results calculation={record.result} />
        </>
      ) : (
        <>
          <p>
            {t(
              "Arbeite die Belege, historischen Wohnungsdaten, Kosten und Vorauszahlungen durch. Erst nach vollständiger Prüfung ist die Finalisierung möglich.",
            )}
          </p>
          <details open>
            <summary>{t("1. Belege und KI-Vorschläge")}</summary>
            <p>
              {t(
                "Alle zugeordneten Unterlagen werden nach ihrem Leistungszeitraum geprüft. Das Upload-Datum schränkt die Auswahl nicht ein.",
              )}
            </p>
            {form.documents.map((doc, index) => (
              <div className="assistant-row" key={doc.id}>
                <a
                  href={fileService.url(doc.id, true)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {doc.name}
                </a>
                {doc.warning && (
                  <p className="assistant-notice">{doc.warning}</p>
                )}
                <label className="assistant-field">
                  {t("Belegstatus")}
                  <select
                    value={doc.status}
                    onChange={(event) =>
                      update("documents", index, { status: event.target.value })
                    }
                  >
                    {[
                      ["pending", "Noch prüfen"],
                      ["checked", "Geprüft"],
                      ["excluded", "Nicht relevant"],
                    ].map(([key, label]) => (
                      <option key={key} value={key}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </label>
                {doc.status === "excluded" && (
                  <Field
                    label="Begründung"
                    value={doc.reason}
                    onChange={(reason) =>
                      update("documents", index, { reason })
                    }
                  />
                )}
              </div>
            ))}
            <Check value={consent} onChange={setConsent}>
              {t(
                "Ich bestätige die Verarbeitung aller nicht ausgeschlossenen Belege durch meinen persönlichen LLM-Anbieter. Dabei können API-Kosten entstehen.",
              )}
            </Check>
            <button
              className="btn-outline"
              disabled={state.busy || working || !consent}
              onClick={() => state.run(() => launch("analyze"))}
            >
              {t("Belege mit KI auslesen")}
            </button>
            {!!form.costCandidates?.length && (
              <details>
                <summary>{t("Bereits erfasste Kosten übernehmen")}</summary>
                {form.costCandidates.map((cost) => (
                  <div className="assistant-row" key={cost.id}>
                    {cost.name} · {cost.amount} €
                    <button
                      className="btn-outline"
                      disabled={form.items.some(
                        (item) => item.reference === cost.id,
                      )}
                      onClick={() =>
                        set("items", [
                          ...form.items,
                          {
                            id: crypto.randomUUID(),
                            name: cost.name,
                            amount: String(cost.amount),
                            start: cost.serviceStart || "",
                            end: cost.serviceEnd || "",
                            category: cost.costCategory || "",
                            documentId:
                              cost.attachments?.find((attachment) =>
                                form.documents.some(
                                  (doc) => doc.id === attachment.id,
                                ),
                              )?.id || "",
                            page: "",
                            allocation: "area",
                            contractBasis: "",
                            reference: cost.id,
                            confirmed: false,
                          },
                        ])
                      }
                    >
                      {t("Als ungeprüfte Position übernehmen")}
                    </button>
                  </div>
                ))}
              </details>
            )}
          </details>
          <details>
            <summary>
              {t("2. Wohnungen und historische Nutzungszeiträume")}
            </summary>
            {form.units.map((unit, index) => (
              <div key={unit.id} className="assistant-row">
                <h3>{unit.name}</h3>
                <Field
                  label="Wohnfläche im Abrechnungszeitraum (m²)"
                  type="number"
                  min="0.01"
                  step="0.0001"
                  value={unit.area}
                  onChange={(area) => update("units", index, { area })}
                />
                <Check
                  value={unit.confirmed}
                  onChange={(confirmed) =>
                    update("units", index, { confirmed })
                  }
                >
                  {t("Historische Wohnungsdaten geprüft")}
                </Check>
                {unit.periods.map((period, pindex) => (
                  <div key={period.id}>
                    <p>
                      {period.name} · {period.start} – {period.end}
                    </p>
                    <PersonCounts
                      period={period}
                      onChange={(changes) =>
                        update("units", index, {
                          periods: unit.periods.map((row, i) =>
                            i === pindex ? { ...row, ...changes } : row,
                          ),
                        })
                      }
                    />
                    <Check
                      value={period.confirmed}
                      onChange={(confirmed) =>
                        update("units", index, {
                          periods: unit.periods.map((row, i) =>
                            i === pindex ? { ...row, confirmed } : row,
                          ),
                        })
                      }
                    >
                      {t("Nutzungszeitraum und Empfänger geprüft")}
                    </Check>
                  </div>
                ))}
              </div>
            ))}
            <Check
              value={form.houseConfirmed}
              onChange={(value) => set("houseConfirmed", value)}
            >
              {t(
                "Alle beteiligten Einheiten einschließlich Leerstand sind enthalten. Mietverhältnisse und Vertragsgrundlagen sind geprüft.",
              )}
            </Check>
          </details>
          <details>
            <summary>{t("3. Kosten und Verteilung")}</summary>
            {form.items.map((item, index) => (
              <div className="assistant-row" key={index}>
                <div className="assistant-grid">
                  <Field
                    label="Kostenposition"
                    value={item.name}
                    onChange={(name) => update("items", index, { name })}
                  />
                  <Field
                    label="Kostenart"
                    value={item.category}
                    onChange={(category) =>
                      update("items", index, { category })
                    }
                  />
                  <Field
                    label="Betrag (€), Gutschriften negativ"
                    value={item.amount}
                    onChange={(amount) => update("items", index, { amount })}
                  />
                  <Field
                    label="Leistungsbeginn"
                    type="date"
                    value={item.start}
                    onChange={(start) => update("items", index, { start })}
                  />
                  <Field
                    label="Leistungsende"
                    type="date"
                    value={item.end}
                    onChange={(end) => update("items", index, { end })}
                  />
                  <DocSelect
                    documents={form.documents}
                    value={item.documentId}
                    onChange={(documentId) =>
                      update("items", index, { documentId })
                    }
                  />
                  <Field
                    label="Seite / Fundstelle"
                    value={item.page}
                    onChange={(page) => update("items", index, { page })}
                  />
                  <Field
                    label="Rechnungsnummer / Position"
                    value={item.reference}
                    onChange={(reference) =>
                      update("items", index, { reference })
                    }
                  />
                  <Field
                    label="Vertragliche Grundlage der Umlage"
                    value={item.contractBasis}
                    onChange={(contractBasis) =>
                      update("items", index, { contractBasis })
                    }
                  />
                  <label className="assistant-field">
                    {t("Verteilerschlüssel")}
                    <select
                      value={item.allocation}
                      onChange={(event) =>
                        update("items", index, {
                          allocation: event.target.value,
                        })
                      }
                    >
                      {Object.entries(ALLOCATION_KEYS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {t(label)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {["consumption", "fixed"].includes(item.allocation) &&
                  rows.map((period) => (
                    <Field
                      key={period.id}
                      label={`${period.unit} · ${period.name} · ${period.start} – ${period.end}`}
                      type="number"
                      min="0"
                      step="0.0001"
                      value={item.weights?.[period.id] ?? ""}
                      onChange={(value) =>
                        update("items", index, {
                          weights: { ...item.weights, [period.id]: value },
                        })
                      }
                    />
                  ))}
                <Check
                  value={item.excluded}
                  onChange={(excluded) => update("items", index, { excluded })}
                >
                  {t("Position nicht umlegen")}
                </Check>
                {item.excluded ? (
                  <Field
                    label="Begründung"
                    value={item.reason}
                    onChange={(reason) => update("items", index, { reason })}
                  />
                ) : (
                  <Check
                    value={item.confirmed}
                    onChange={(confirmed) =>
                      update("items", index, { confirmed })
                    }
                  >
                    {t(
                      "Betrag, Zeitraum, Umlagefähigkeit, Vertragsgrundlage und Schlüssel geprüft",
                    )}
                  </Check>
                )}
                <button
                  className="btn-outline"
                  onClick={() =>
                    set(
                      "items",
                      form.items.filter((_, position) => position !== index),
                    )
                  }
                >
                  {t("Position entfernen")}
                </button>
              </div>
            ))}
            <button
              className="btn-outline"
              onClick={() =>
                set("items", [
                  ...form.items,
                  {
                    id: crypto.randomUUID(),
                    name: "",
                    category: "",
                    amount: "0.00",
                    start: record.start,
                    end: record.end,
                    allocation: "area",
                    documentId: "",
                    page: "",
                    contractBasis: "",
                    reference: "",
                    weights: {},
                  },
                ])
              }
            >
              {t("Kostenposition hinzufügen")}
            </button>
          </details>
          <details>
            <summary>{t("4. Externe Heiz- und Warmwasserkosten")}</summary>
            <p>
              {t(
                "Übernimm die Beträge der externen Einzelabrechnung je Mietverhältnis. Zuloni berechnet keine eigene Heizkosten- oder CO₂-Verteilung.",
              )}
            </p>
            {form.heating.map((item, index) => (
              <div className="assistant-row" key={index}>
                <PeriodSelect
                  rows={rows}
                  value={item.periodId}
                  onChange={(periodId) =>
                    update("heating", index, { periodId })
                  }
                />
                <Field
                  label="Betrag (€)"
                  value={item.amount}
                  onChange={(amount) => update("heating", index, { amount })}
                />
                <DocSelect
                  documents={form.documents}
                  value={item.documentId}
                  onChange={(documentId) =>
                    update("heating", index, { documentId })
                  }
                />
                <Field
                  label="Seite / Fundstelle"
                  value={item.page}
                  onChange={(page) => update("heating", index, { page })}
                />
                <Check
                  value={item.confirmed}
                  onChange={(confirmed) =>
                    update("heating", index, { confirmed })
                  }
                >
                  {t("Externe Heizkostenposition geprüft")}
                </Check>
                <button
                  className="btn-outline"
                  onClick={() =>
                    set(
                      "heating",
                      form.heating.filter((_, position) => position !== index),
                    )
                  }
                >
                  {t("Position entfernen")}
                </button>
              </div>
            ))}
            <button
              className="btn-outline"
              onClick={() =>
                set("heating", [
                  ...form.heating,
                  {
                    periodId: rows.find((row) => !row.owner)?.id || rows[0]?.id,
                    amount: "0.00",
                    documentId: "",
                    page: "",
                  },
                ])
              }
            >
              {t("Heizkostenposition hinzufügen")}
            </button>
            <Check
              value={form.heatingConfirmed}
              onChange={(value) => set("heatingConfirmed", value)}
            >
              {t(
                "Alle erforderlichen externen Heizkostenabrechnungen sind übernommen oder es fallen keine abzurechnenden Heizkosten an.",
              )}
            </Check>
          </details>
          <details>
            <summary>{t("5. Tatsächliche Nebenkostenvorauszahlungen")}</summary>
            {form.advances.map((item, index) => (
              <div className="assistant-row" key={index}>
                <PeriodSelect
                  rows={rows.filter((row) => !row.owner)}
                  value={item.leaseId}
                  onChange={(leaseId) => update("advances", index, { leaseId })}
                />
                <div className="assistant-grid">
                  <Field
                    label="Zahlungsdatum"
                    type="date"
                    value={item.date}
                    onChange={(date) => update("advances", index, { date })}
                  />
                  <Field
                    label="Tatsächlich gezahlter Nebenkostenbetrag (€)"
                    value={item.amount}
                    onChange={(amount) => update("advances", index, { amount })}
                  />
                  <Field
                    label="Zahlungsnachweis / Referenz"
                    value={item.reference}
                    onChange={(reference) =>
                      update("advances", index, { reference })
                    }
                  />
                </div>
                <Check
                  value={item.confirmed}
                  onChange={(confirmed) =>
                    update("advances", index, { confirmed })
                  }
                >
                  {t("Tatsächliche Vorauszahlung geprüft")}
                </Check>
                <button
                  className="btn-outline"
                  onClick={() =>
                    set(
                      "advances",
                      form.advances.filter((_, position) => position !== index),
                    )
                  }
                >
                  {t("Zahlung entfernen")}
                </button>
              </div>
            ))}
            <button
              className="btn-outline"
              disabled={!rows.some((row) => !row.owner)}
              onClick={() =>
                set("advances", [
                  ...form.advances,
                  {
                    leaseId: rows.find((row) => !row.owner)?.leaseId,
                    date: record.start,
                    amount: "0.00",
                    reference: "",
                  },
                ])
              }
            >
              {t("Vorauszahlung hinzufügen")}
            </button>
            <Check
              value={form.advancesConfirmed}
              onChange={(value) => set("advancesConfirmed", value)}
            >
              {t(
                "Alle tatsächlich geleisteten Nebenkostenvorauszahlungen sind vollständig erfasst. Vertragswerte wurden nicht ungeprüft übernommen.",
              )}
            </Check>
          </details>
          <Results calculation={calculation} />
          {!!calculation.issues.length && (
            <div className="assistant-notice">
              <h3>{t("Vor Finalisierung zu prüfen")}</h3>
              <ul>
                {calculation.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="assistant-actions">
            <button
              className="btn-outline"
              disabled={state.busy || working}
              onClick={() =>
                state.run(async () => {
                  await save();
                  await onReload();
                })
              }
            >
              {t("Entwurf speichern")}
            </button>
            <button
              className="btn-primary"
              disabled={state.busy || working || !!calculation.issues.length}
              onClick={() => state.run(() => launch("finalize"))}
            >
              {t("Abrechnungen freigeben und PDFs erstellen")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
function DocSelect({ documents, value, onChange }) {
  const { t } = useTranslation();
  return (
    <label className="assistant-field">
      {t("Originalbeleg")}
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{t("Bitte auswählen")}</option>
        {documents.map((doc) => (
          <option key={doc.id} value={doc.id}>
            {doc.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function PersonCounts({ period, onChange }) {
  const { t } = useTranslation();
  if (!period.occupancy?.length)
    return (
      <>
        <Field
          label="Dokumentierte Personenzahl im gesamten Nutzungszeitraum"
          type="number"
          min="0"
          step="1"
          value={period.personCount}
          onChange={(personCount) => onChange({ personCount })}
        />
        <button
          className="btn-outline"
          onClick={() =>
            onChange({
              occupancy: [
                {
                  start: period.start,
                  end: period.end,
                  count: period.personCount,
                },
              ],
            })
          }
        >
          {t("Änderungen der Personenzahl erfassen")}
        </button>
      </>
    );
  return (
    <div>
      <p>
        {t(
          "Erfasse lückenlos die Teilzeiträume mit der jeweils dokumentierten Personenzahl.",
        )}
      </p>
      {period.occupancy.map((segment, index) => (
        <div className="assistant-grid" key={index}>
          <Field
            label="Beginn"
            type="date"
            value={segment.start}
            onChange={(start) =>
              onChange({
                occupancy: period.occupancy.map((item, i) =>
                  i === index ? { ...item, start } : item,
                ),
              })
            }
          />
          <Field
            label="Ende"
            type="date"
            value={segment.end}
            onChange={(end) =>
              onChange({
                occupancy: period.occupancy.map((item, i) =>
                  i === index ? { ...item, end } : item,
                ),
              })
            }
          />
          <Field
            label="Personenzahl"
            type="number"
            min="0"
            step="1"
            value={segment.count}
            onChange={(count) =>
              onChange({
                occupancy: period.occupancy.map((item, i) =>
                  i === index ? { ...item, count } : item,
                ),
              })
            }
          />
          <button
            className="btn-outline"
            onClick={() =>
              onChange({
                occupancy: period.occupancy.filter((_, i) => i !== index),
              })
            }
          >
            {t("Teilzeitraum entfernen")}
          </button>
        </div>
      ))}
      <button
        className="btn-outline"
        onClick={() =>
          onChange({
            occupancy: [...period.occupancy, { start: "", end: "", count: "" }],
          })
        }
      >
        {t("Teilzeitraum hinzufügen")}
      </button>
    </div>
  );
}
function PeriodSelect({ rows, value, onChange }) {
  const { t } = useTranslation();
  return (
    <label className="assistant-field">
      {t("Nutzungszeitraum / Empfänger")}
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{t("Bitte auswählen")}</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.unit} · {row.name} · {row.start} – {row.end}
          </option>
        ))}
      </select>
    </label>
  );
}
function Results({ calculation }) {
  const { t } = useTranslation();
  if (!calculation) return null;
  return (
    <section className="assistant-card">
      <h2>{t("Berechnungsvorschau")}</h2>
      <div className="assistant-table-wrap">
        <table className="assistant-table">
          <thead>
            <tr>
              {[
                "Wohnung / Empfänger",
                "Kostenanteil",
                "Vorauszahlungen",
                "Nachzahlung / Guthaben",
              ].map((label) => (
                <th key={label}>{t(label)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calculation.rows.map((row) => (
              <tr key={row.periodId}>
                <td>
                  {row.unit} · {row.name}
                  <br />
                  {row.start} – {row.end}
                </td>
                <td>{euros(row.totalCents)}</td>
                <td>{euros(row.advanceCents)}</td>
                <td>{euros(row.balanceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="assistant-muted">
        {t(
          "Eigentümer- und Leerstandsanteile bleiben beim Eigentümer. Negative Salden sind Guthaben.",
        )}
      </p>
    </section>
  );
}
