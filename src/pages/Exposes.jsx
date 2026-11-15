import React, { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useData } from "../context/DataContext";
import { useAssistant, useRecordJob } from "../hooks/useAssistant";
import { api } from "../utils/api";
import { fileService } from "../db/services/fileService";
import {
  AssistantField as Field,
  AssistantCheck as Check,
  JobStatus,
} from "../components/AssistantCommon";

export default function Exposes() {
  const { id } = useParams(),
    { t } = useTranslation(),
    { properties, documents } = useData();
  const state = useAssistant("/exposes"),
    [selected, setSelected] = useState(null);
  const property = properties.find((property) => property.id === id);
  if (!property) return <p>{t("Wohnung nicht gefunden.")}</p>;
  const reload = async () => {
    await state.refresh();
  };
  return (
    <div className="page-container assistant-page">
      <Link to={`/properties/${id}?tab=rental`}>{t("← Zur Wohnung")}</Link>
      <h1>
        {t("Exposé erstellen")} · {property.name}
      </h1>
      {state.error && (
        <p role="alert" className="assistant-error">
          {state.error}
        </p>
      )}
      <button
        className="btn-primary"
        disabled={state.busy}
        onClick={() =>
          state.run(async () => {
            const draft = await api.post("/exposes", {
              propertyId: id,
              documentIds: documents
                .filter(
                  (doc) =>
                    doc.propertyId === id &&
                    doc.published &&
                    ["Photos", "FloorPlans"].includes(doc.category),
                )
                .slice(0, 12)
                .map((doc) => doc.id),
            });
            await reload();
            setSelected(draft.id);
          })
        }
      >
        {t("Neues Exposé")}
      </button>
      {(state.data || [])
        .filter((record) => record.propertyId === id)
        .map((record) => (
          <section className="assistant-card" key={record.id}>
            <div className="assistant-actions">
              <button
                className="btn-outline"
                onClick={() =>
                  setSelected(selected === record.id ? null : record.id)
                }
              >
                {record.title || t("Exposé-Entwurf")} ·{" "}
                {t(record.status === "final" ? "Finalisiert" : "Entwurf")}
              </button>
              {record.pdfIds?.map((pdfId) => (
                <a
                  className="btn-outline"
                  key={pdfId}
                  href={fileService.url(pdfId)}
                >
                  {t("PDF herunterladen")}
                </a>
              ))}
            </div>
            {selected === record.id && (
              <ExposeEditor
                key={`${record.id}:${record.revision}`}
                record={record}
                documents={documents}
                onReload={reload}
              />
            )}
          </section>
        ))}
    </div>
  );
}
function ExposeEditor({ record, documents, onReload }) {
  const { t } = useTranslation(),
    state = useAssistant("", false),
    [form, setForm] = useState(record),
    [consent, setConsent] = useState(false);
  const { job, setJob, working, setWorking } = useRecordJob(record.id);
  const change = (key, value) => setForm({ ...form, [key]: value });
  const completed = useCallback(() => {
    onReload();
  }, [onReload]);
  if (record.status === "final")
    return (
      <>
        <p>{record.intro}</p>
        <button
          className="btn-outline"
          onClick={() =>
            state.run(async () => {
              await api.post("/exposes", {
                ...record,
                copyOf: record.id,
                reviewed: false,
              });
              await onReload();
            })
          }
        >
          {t("Neue Version anlegen")}
        </button>
      </>
    );
  const save = async () => {
    const saved = await api.put(`/exposes/${record.id}`, form);
    setForm(saved);
    return saved;
  };
  const start = async (action) => {
    await save();
    const result = await api.post(`/exposes/${record.id}/${action}`, {
      requestKey: crypto.randomUUID(),
      consent,
    });
    setJob(result.id);
    setWorking(true);
  };
  return (
    <div>
      {record.simulated && (
        <p className="assistant-notice">
          {t(
            "Simulation: Dieser Entwurf enthält keine echte Webrecherche und wird im PDF als Simulation gekennzeichnet.",
          )}
        </p>
      )}
      {state.error && (
        <p role="alert" className="assistant-error">
          {state.error}
        </p>
      )}
      <Field
        label="Verfügbar ab"
        type="date"
        value={form.availableFrom}
        onChange={(value) => change("availableFrom", value)}
      />
      <details>
        <summary>{t("Unterlagen und Bilder auswählen")}</summary>
        {documents
          .filter(
            (doc) =>
              doc.propertyId === record.propertyId &&
              doc.hasFile &&
              (["Photos", "FloorPlans"].includes(doc.category)
                ? doc.published
                : doc.category === "Energy"),
          )
          .map((doc) => (
            <Check
              key={doc.id}
              value={form.documentIds.includes(doc.id)}
              onChange={(checked) =>
                change(
                  "documentIds",
                  checked
                    ? [...form.documentIds, doc.id]
                    : form.documentIds.filter((id) => id !== doc.id),
                )
              }
            >
              {doc.name}
            </Check>
          ))}
        <p>
          {t(
            "Es werden ausschließlich freigegebene Objektbilder und ausgewählte Energieunterlagen verwendet. Private Mieterdaten werden nicht recherchiert.",
          )}
        </p>
      </details>
      <Check value={consent} onChange={setConsent}>
        {t(
          "Ich bestätige die Verarbeitung der ausgewählten Objektdaten und Unterlagen durch meinen gewählten LLM-Anbieter einschließlich Webrecherche. Dabei können API-Kosten entstehen.",
        )}
      </Check>
      <button
        className="btn-outline"
        disabled={state.busy || !consent || working}
        onClick={() => state.run(() => start("generate"))}
      >
        {t("KI-Entwurf erstellen")}
      </button>
      {job && (
        <JobStatus
          key={job}
          id={job}
          onComplete={completed}
          onSettled={() => setWorking(false)}
        />
      )}
      {[
        ["title", "Titel"],
        ["intro", "Kurzbeschreibung"],
        ["features", "Ausstattung"],
        ["building", "Hausbeschreibung"],
        ["location", "Lagebeschreibung"],
        ["terms", "Konditionen"],
        ["contact", "Kontakt im Exposé"],
      ].map(([key, label]) => (
        <Field
          key={key}
          label={label}
          multiline={key !== "title"}
          value={form[key]}
          onChange={(value) => change(key, value)}
        />
      ))}
      {!!record.warnings?.length && (
        <div className="assistant-notice">
          <h3>{t("Offene Angaben")}</h3>
          {record.warnings.map((warning, index) => (
            <p key={index}>{warning}</p>
          ))}
          <Check
            value={form.resolvedWarnings}
            onChange={(value) => change("resolvedWarnings", value)}
          >
            {t(
              "Ich habe die offenen Angaben ergänzt oder unbelegte Aussagen entfernt.",
            )}
          </Check>
        </div>
      )}
      {record.sources?.map((source, index) => (
        <p key={index}>
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.title || source.url}
          </a>{" "}
          · {source.accessedAt?.slice(0, 10)}
        </p>
      ))}
      <Check
        value={form.reviewed}
        onChange={(value) => change("reviewed", value)}
      >
        {t(
          "Ich habe Objektfakten, Texte, Bilder, Quellen und Kontakt geprüft und gebe diesen Entwurf frei.",
        )}
      </Check>
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
          disabled={state.busy || !form.reviewed || working}
          onClick={() => state.run(() => start("finalize"))}
        >
          {t("PDF erstellen und finalisieren")}
        </button>
      </div>
    </div>
  );
}
