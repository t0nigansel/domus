import React, { useEffect, useId, useRef, useState } from "react";
import { api } from "../utils/api";
import { useTranslation } from "../i18n";
import "../pages/Assistants.css";

export function AssistantField({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
  ...rest
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="assistant-field">
      <label htmlFor={id}>{t(label)}</label>
      {multiline ? (
        <textarea
          id={id}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          {...rest}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          {...rest}
        />
      )}
    </div>
  );
}
export function AssistantCheck({ children, value, onChange, ...rest }) {
  return (
    <label className="assistant-check">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(event) => onChange(event.target.checked)}
        {...rest}
      />
      {children}
    </label>
  );
}
export function JobStatus({ id, onComplete, onSettled }) {
  const { t } = useTranslation();
  const [job, setJob] = useState(null),
    [error, setError] = useState("");
  const callbacks = useRef({ onComplete, onSettled });
  useEffect(() => {
    callbacks.current = { onComplete, onSettled };
  }, [onComplete, onSettled]);
  useEffect(() => {
    let active = true,
      timer;
    const poll = async () => {
      try {
        const value = await api.get(`/jobs/${id}`);
        if (!active) return;
        setJob(value);
        if (["queued", "running"].includes(value.status))
          timer = setTimeout(poll, 2000);
        else {
          callbacks.current.onSettled?.();
          if (value.status === "completed") callbacks.current.onComplete?.();
        }
      } catch (error) {
        if (active) setError(error.message);
      }
    };
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);
  return (
    <div className="assistant-notice" role="status">
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <p>
          {t(
            {
              queued: "Auftrag wartet …",
              running: "Auftrag wird verarbeitet …",
              completed: "Auftrag abgeschlossen.",
              failed: "Auftrag fehlgeschlagen.",
              cancelled: "Auftrag abgebrochen.",
            }[job?.status] || "Auftrag wird geladen …",
          )}
        </p>
      )}
      {job?.error && <p role="alert">{job.error}</p>}
      {job?.result?.total > 0 && (
        <p>
          {t("Verarbeitet")}: {job.result.processed || 0} / {job.result.total}
        </p>
      )}
      {["queued", "running"].includes(job?.status) && job.kind !== "delete" && (
        <button
          className="btn-outline"
          onClick={() =>
            api
              .post(`/jobs/${id}/cancel`, {})
              .then(() => setJob({ ...job, status: "cancelled" }))
              .catch((error) => setError(error.message))
          }
        >
          {t("Abbrechen")}
        </button>
      )}
      {job?.status === "completed" &&
        ["export", "statement-zip"].includes(job.kind) && (
          <a className="btn-primary" href={`/api/jobs/${id}/download`}>
            {t("ZIP herunterladen")}
          </a>
        )}
    </div>
  );
}
