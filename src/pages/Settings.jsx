import React, { useEffect, useState } from "react";
import { useTranslation, setLanguage as applyLanguage } from "../i18n";
import { useTheme } from "../context/ThemeContext";
import { useCloudAuth } from "../context/CloudAuthContext";
import { useAssistant } from "../hooks/useAssistant";
import { api } from "../utils/api";
import { fileService } from "../db/services/fileService";
import { McpConnections } from './McpAccess';
import {
  AssistantField as Field,
  JobStatus,
} from "../components/AssistantCommon";

export default function Settings() {
  const { t, language, setLanguage } = useTranslation();
  const { appearance, setAppearance } = useTheme();
  const auth = useCloudAuth();
  const state = useAssistant("/settings", !!auth);
  const history = useAssistant("/jobs", !!auth);
  const [message, setMessage] = useState(""),
    [job, setJob] = useState("");
  if (auth && !state.data)
    return (
      <div className="page-container assistant-page">
        <h1>{t("Einstellungen")}</h1>
        {state.error ? <p role="alert">{state.error}</p> : <p>{t("Lädt …")}</p>}
      </div>
    );
  const value = state.data || {
    appearance,
    language,
    sender: {},
    provider: "",
  };
  const change = (key, next) => state.setData({ ...value, [key]: next });
  const sender = (key, next) =>
    change("sender", { ...value.sender, [key]: next });
  return (
    <div className="page-container assistant-page">
      <h1>{t("Einstellungen")}</h1>
      {state.error && (
        <p role="alert" className="assistant-error">
          {state.error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          state.run(async () => {
            if (auth) await api.put("/settings", value);
            setAppearance(value.appearance);
            setLanguage(value.language);
            setMessage(t("Einstellungen gespeichert."));
          });
        }}
      >
        <section className="assistant-card">
          <h2>{t("Darstellung und Sprache")}</h2>
          <div className="assistant-grid">
            <label className="assistant-field">
              {t("Darstellung")}
              <select
                value={value.appearance}
                onChange={(event) => change("appearance", event.target.value)}
              >
                {[
                  ["system", "System"],
                  ["light", "Hell"],
                  ["dark", "Dunkel"],
                ].map(([key, label]) => (
                  <option key={key} value={key}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="assistant-field">
              {t("Sprache")}
              <select
                value={value.language}
                onChange={(event) => change("language", event.target.value)}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
        </section>
        {auth && (
          <section className="assistant-card">
            <h2>{t("Absender für Dokumente")}</h2>
            <div className="assistant-grid">
              {[
                ["name", "Name / Firma"],
                ["address", "Anschrift"],
                ["email", "E-Mail-Adresse"],
                ["phone", "Telefon"],
              ].map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  multiline={key === "address"}
                  value={value.sender?.[key] || ""}
                  onChange={(next) => sender(key, next)}
                />
              ))}
            </div>
            <label className="assistant-field">
              {t("Logo (PNG, JPG oder WebP, bis 1 MB)")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files[0];
                  event.target.value = "";
                  if (file)
                    state.run(async () => {
                      if (file.size > 1024 * 1024)
                        throw new Error(
                          t("Das Logo darf höchstens 1 MB groß sein."),
                        );
                      const result = await fileService.upload(file, {
                        category: "Photos",
                      });
                      sender("logoId", result.document.id);
                    });
                }}
              />
            </label>
            {value.sender?.logoId && (
              <div className="assistant-actions">
                <img
                  src={fileService.url(value.sender.logoId, true)}
                  alt={t("Logo")}
                  style={{ maxWidth: 150, maxHeight: 80 }}
                />
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => sender("logoId", "")}
                >
                  {t("Logo entfernen")}
                </button>
              </div>
            )}
          </section>
        )}
        <button className="btn-primary" disabled={state.busy}>
          {t("Einstellungen speichern")}
        </button>
      </form>
      {auth ? (
        <>
          <Connections
            simulation={value.simulation}
            selected={value.provider}
            onSelect={(provider) =>
              state.run(async () => {
                const next = { ...value, provider };
                await api.put("/settings", next);
                state.setData(next);
              })
            }
          />
          <Security />
          <McpConnections />
          <section className="assistant-card">
            <h2>{t("Daten und Konto")}</h2>
            <p>
              {t(
                "Exportiere alle Verwaltungsdaten und Originaldateien als ZIP. Zugangsschlüssel und Passwörter sind nicht enthalten.",
              )}
            </p>
            <button
              className="btn-outline"
              disabled={state.busy}
              onClick={() =>
                state.run(async () =>
                  setJob(
                    (
                      await api.post("/account/export", {
                        requestKey: crypto.randomUUID(),
                      })
                    ).id,
                  ),
                )
              }
            >
              {t("Alle Daten exportieren")}
            </button>
            {job && <JobStatus key={job} id={job} />}
            {(history.data || [])
              .filter(
                (previous) => previous.kind === "export" && previous.id !== job,
              )
              .slice(0, 3)
              .map((previous) => (
                <JobStatus key={previous.id} id={previous.id} />
              ))}
          </section>
          <DeleteAccount />
        </>
      ) : (
        <p className="assistant-notice">
          {t(
            "Persönliche LLM-Zugänge und Kontofunktionen stehen in der angemeldeten Cloud-Anwendung zur Verfügung.",
          )}
        </p>
      )}
    </div>
  );
}
function Connections({ simulation, selected, onSelect }) {
  const { t } = useTranslation(),
    state = useAssistant("/llm-connections");
  const [provider, setProvider] = useState("openai"),
    [key, setKey] = useState(""),
    [model, setModel] = useState("gpt-4.1"),
    [models, setModels] = useState([]),
    [message, setMessage] = useState("");
  return (
    <section className="assistant-card">
      <h2>{t("Persönliche LLM-Anbindung")}</h2>
      {simulation && (
        <p className="assistant-notice">
          {t(
            "Testbetrieb: Anbieterantworten werden simuliert. Es werden keine externen LLM-Anfragen gesendet.",
          )}
        </p>
      )}
      <p>
        {t(
          "Dein API-Schlüssel wird verschlüsselt gespeichert. Die API-Nutzung wird von deinem Anbieter abgerechnet. Vor jedem Auftrag siehst du, welche Unterlagen verarbeitet werden.",
        )}
      </p>
      {state.error && (
        <p role="alert" className="assistant-error">
          {state.error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {(state.data || []).map((connection) => (
        <div className="assistant-row" key={connection.provider}>
          <strong>
            {connection.provider} · {connection.model}
          </strong>
          <p>
            {t(connection.tested ? "Verbindung geprüft" : "Noch nicht geprüft")}{" "}
            · ••••••••
          </p>
          <div className="assistant-actions">
            <button
              className="btn-outline"
              disabled={state.busy}
              onClick={() =>
                state.run(async () => {
                  const result = await api.post(
                    `/llm-connections/${connection.provider}/test`,
                    {},
                  );
                  setMessage(
                    t(
                      result.simulated
                        ? "Simulierte Verbindung geprüft."
                        : "Verbindung geprüft.",
                    ),
                  );
                  await state.refresh();
                })
              }
            >
              {t("Verbindung prüfen")}
            </button>
            <button
              className="btn-outline"
              disabled={!connection.tested || state.busy}
              onClick={() => onSelect(connection.provider)}
            >
              {t(
                selected === connection.provider
                  ? "Ausgewählt"
                  : "Für Assistenten verwenden",
              )}
            </button>
            <button
              className="btn-outline"
              disabled={state.busy}
              onClick={() =>
                state.run(async () => {
                  await api.delete(`/llm-connections/${connection.provider}`);
                  await state.refresh();
                })
              }
            >
              {t("Verbindung entfernen")}
            </button>
          </div>
        </div>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          state.run(async () => {
            try {
              await api.put(`/llm-connections/${provider}`, { key, model });
              setMessage(
                t("Schlüssel gespeichert. Bitte die Verbindung prüfen."),
              );
              await state.refresh();
            } finally {
              setKey("");
            }
          });
        }}
      >
        <div className="assistant-grid">
          <label className="assistant-field">
            {t("Anbieter")}
            <select
              value={provider}
              onChange={(event) => {
                const next = event.target.value;
                setProvider(next);
                setModel(
                  {
                    openai: "gpt-4.1",
                    anthropic: "claude-sonnet-4-5",
                    google: "gemini-2.5-pro",
                  }[next],
                );
                setModels([]);
              }}
            >
              {[
                ["openai", "OpenAI"],
                ["anthropic", "Anthropic"],
                ["google", "Google"],
              ].map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="API-Schlüssel"
            type="password"
            autoComplete="new-password"
            required
            value={key}
            onChange={setKey}
          />
          <Field
            label="Modell"
            required
            list="available-models"
            value={model}
            onChange={setModel}
          />
          <datalist id="available-models">
            {models.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </div>
        <div className="assistant-actions">
          <button className="btn-primary" disabled={state.busy}>
            {t("Verbindung speichern / ersetzen")}
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={
              state.busy ||
              !state.data?.some(
                (connection) => connection.provider === provider,
              )
            }
            onClick={() =>
              state.run(async () =>
                setModels(
                  await api.post(`/llm-connections/${provider}/models`, {}),
                ),
              )
            }
          >
            {t("Verfügbare Modelle laden")}
          </button>
        </div>
      </form>
    </section>
  );
}
function Security() {
  const { t } = useTranslation(),
    state = useAssistant("", false),
    auth = useCloudAuth();
  const [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [email, setEmail] = useState(""),
    [message, setMessage] = useState("");
  return (
    <section className="assistant-card">
      <h2>{t("Zugang und Sicherheit")}</h2>
      <p>{auth.user.email}</p>
      {state.error && (
        <p role="alert" className="assistant-error">
          {state.error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <Field
        label="Aktuelles Passwort"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={setCurrent}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          state.run(async () => {
            await api.post("/account/password", {
              currentPassword: current,
              password,
            });
            setCurrent("");
            setPassword("");
            setMessage(
              t("Passwort geändert. Andere Sitzungen wurden beendet."),
            );
          });
        }}
      >
        <Field
          label="Neues Passwort"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
          value={password}
          onChange={setPassword}
        />
        <button className="btn-outline" disabled={!current || state.busy}>
          {t("Passwort ändern")}
        </button>
      </form>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          state.run(async () => {
            await api.post("/account/email", {
              currentPassword: current,
              email,
            });
            setCurrent("");
            setEmail("");
            setMessage(
              t(
                "Bitte bestätige die Änderung zuerst über die bisherige und anschließend über die neue E-Mail-Adresse.",
              ),
            );
          });
        }}
      >
        <Field
          label="Neue E-Mail-Adresse"
          type="email"
          required
          value={email}
          onChange={setEmail}
        />
        <button className="btn-outline" disabled={!current || state.busy}>
          {t("E-Mail-Adresse ändern")}
        </button>
      </form>
    </section>
  );
}
function DeleteAccount() {
  const { t } = useTranslation(),
    state = useAssistant("", false);
  const [opened, setOpened] = useState(false),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [job, setJob] = useState("");
  return (
    <section className="assistant-card">
      <h2>{t("Konto endgültig löschen")}</h2>
      <p>
        {t(
          "Alle Immobilien, Mieterdaten, Unterlagen und LLM-Schlüssel werden gelöscht. Lade vorher bei Bedarf deinen vollständigen Export herunter. Diese Aktion kann nicht rückgängig gemacht werden.",
        )}
      </p>
      {state.error && (
        <p className="assistant-error" role="alert">
          {state.error}
        </p>
      )}
      {!opened ? (
        <button className="btn-outline" onClick={() => setOpened(true)}>
          {t("Kontolöschung vorbereiten")}
        </button>
      ) : job ? (
        <>
          <p>
            {t(
              "Dein Konto ist gesperrt und wird vollständig gelöscht. Nach Abschluss wirst du abgemeldet.",
            )}
          </p>
          <JobStatus id={job} />
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            state.run(async () => {
              const result = await api.post("/account/delete", {
                currentPassword: password,
                confirmation,
                requestKey: crypto.randomUUID(),
              });
              setPassword("");
              setJob(result.id);
            });
          }}
        >
          <Field
            label="Aktuelles Passwort"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
          <Field
            label="Zur Bestätigung KONTO LÖSCHEN eingeben"
            required
            value={confirmation}
            onChange={setConfirmation}
          />
          <div className="assistant-actions">
            <button
              className="btn-primary"
              disabled={state.busy || confirmation !== "KONTO LÖSCHEN"}
            >
              {t("Alle Daten endgültig löschen")}
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setOpened(false)}
            >
              {t("Abbrechen")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export function UserPreferences() {
  const auth = useCloudAuth(),
    { setAppearance } = useTheme();
  const userId = auth?.user.id;
  useEffect(() => {
    let active = true;
    if (userId)
      api
        .get("/settings")
        .then((value) => {
          if (active && value.stored) {
            setAppearance(value.appearance);
            applyLanguage(value.language);
          }
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId, setAppearance]);
  return null;
}
