import React, { useState } from "react";
import { Link, useMatch, useNavigate } from "react-router-dom";
import { House } from 'lucide-react';
import { useTranslation } from "../i18n";
import { useCloudAuth } from "../context/CloudAuthContext";
import { useData } from "../context/DataContext";
import { useAssistant } from "../hooks/useAssistant";
import { api } from "../utils/api";
import { AssistantField as Field } from "../components/AssistantCommon";
import { List, ListRow } from '../components/common';
import PropertyFiles from "../components/PropertyFiles";

export default function Buildings() {
  const auth = useCloudAuth(),
    { t } = useTranslation(),
    state = useAssistant("/buildings", !!auth);
  const [adding, setAdding] = useState(false);
  const expandedId = useMatch('/buildings/:id')?.params.id;
  const navigate = useNavigate();
  if (!auth) return null;
  return (
    <section className="building-section">
      <div className="assistant-actions building-heading">
        <h2>{t("Häuser")}</h2>
        <button className="btn-outline" onClick={() => setAdding(!adding)}>
          {t("Haus anlegen")}
        </button>
      </div>
      {state.error && <p role="alert">{state.error}</p>}
      {adding && (
        <div className="assistant-card">
        <BuildingForm
          key="new"
          busy={state.busy}
          onCancel={() => setAdding(false)}
          onSave={(value) =>
            state.run(async () => {
              await api.post("/buildings", value);
              await state.refresh();
              setAdding(false);
            })
          }
        />
        </div>
      )}
      {expandedId && state.data && !state.data.some(building => building.id === expandedId) && <p role="alert">{t('Haus nicht gefunden.')}</p>}
      <List>{state.data?.map((building) => (
        <ListRow key={building.id} icon={<House size={20} />} title={building.name}
          subtitle={[building.street, building.postalCode, building.city].filter(Boolean).join(' · ')}
          expanded={expandedId === building.id}
          onToggle={() => navigate(expandedId === building.id ? '/properties' : `/buildings/${building.id}`, { preventScrollReset: true })}>
          <BuildingDetails id={building.id} onSaved={state.refresh} />
        </ListRow>
      ))}</List>
      {state.data?.length === 0 && (
        <p>
          {t(
            "Lege ein Haus an, um gemeinsame Unterlagen und Nebenkostenabrechnungen zu verwalten.",
          )}
        </p>
      )}
    </section>
  );
}
function BuildingForm({ value = {}, busy, onSave, onCancel }) {
  const { t } = useTranslation(),
    [form, setForm] = useState(value);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}
    >
      <div className="assistant-grid">
        {[
          ["name", "Hausbezeichnung"],
          ["street", "Straße und Hausnummer"],
          ["postalCode", "Postleitzahl"],
          ["city", "Ort"],
          ["year", "Baujahr"],
          ["description", "Hausbeschreibung"],
          ["equipment", "Ausstattung"],
          ["energy", "Energieangaben"],
        ].map(([key, label]) => (
          <Field
            key={key}
            required={key === "name"}
            label={label}
            multiline={["description", "equipment", "energy"].includes(key)}
            value={form[key] || ""}
            onChange={(next) => setForm({ ...form, [key]: next })}
          />
        ))}
      </div>
      <div className="assistant-actions">
        <button className="btn-primary" disabled={busy}>{t('Speichern')}</button>
        <button type="button" className="btn-outline" disabled={busy} onClick={onCancel}>{t('Abbrechen')}</button>
      </div>
    </form>
  );
}
function BuildingDetails({ id, onSaved }) {
  const { t, locale } = useTranslation(),
    { properties, updateProperty, costs, updateCost } = useData();
  const state = useAssistant(`/buildings/${id}`),
    [editing, setEditing] = useState(false),
    [managingUnits, setManagingUnits] = useState(false),
    [editingCosts, setEditingCosts] = useState(false);
  if (!state.data)
    return (
      <div className="building-details-inline">
        <p>{state.error || t("Lädt …")}</p>
      </div>
    );
  const building = state.data;
  const assigned = properties.filter(property => property.buildingId === id);
  const houseCosts = costs.filter(cost => cost.buildingId === id || cost.propertyIds?.some(propertyId => assigned.some(property => property.id === propertyId)));
  return (
    <div className="building-details-inline">
      {state.error && (
        <p role="alert" className="assistant-error">
          {state.error}
        </p>
      )}
      <section className="assistant-card">
        {editing ? (
          <BuildingForm
            key={building.revision}
            value={building}
            busy={state.busy}
            onCancel={() => setEditing(false)}
            onSave={(value) =>
              state.run(async () => {
                state.setData(await api.put(`/buildings/${id}`, value));
                await onSaved();
                setEditing(false);
              })
            }
          />
        ) : (
          <>
            <p>
              {[building.street, building.postalCode, building.city]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p>{building.description}</p>
            <p>{building.equipment}</p>
            <p>{building.energy}</p>
            <button className="btn-outline" onClick={() => setEditing(true)}>
              {t("Hausdaten bearbeiten")}
            </button>
          </>
        )}
      </section>
      <PropertyFiles building={building} />
      <section className="assistant-card">
        <div className="assistant-actions">
          <h2>{t('Wohnungen')} ({assigned.length})</h2>
          <button type="button" className="btn-outline" disabled={state.busy} aria-expanded={managingUnits} onClick={() => setManagingUnits(!managingUnits)}>{t(managingUnits ? 'Fertig' : 'Zuordnung verwalten')}</button>
        </div>
        {!managingUnits && <>
          {assigned.map(property => <p className="assistant-row" key={property.id}><Link to={`/properties/${property.id}`}>{property.name}</Link></p>)}
          {!assigned.length && <p className="text-muted">{t('Noch keine Wohnungen zugeordnet.')}</p>}
        </>}
        {managingUnits && <><p>
          {t(
            "Bestätige die Hauszuordnung ausdrücklich. Bestehende Daten bleiben erhalten.",
          )}
        </p>
        {properties.map((property) => (
          <div className="assistant-row" key={property.id}>
            <Link to={`/properties/${property.id}`}>{property.name}</Link>
            <div className="assistant-actions">
              {property.buildingId === id ? (
                <button
                  className="btn-outline"
                  disabled={state.busy}
                  onClick={() =>
                    state.run(() =>
                      updateProperty(property.id, { buildingId: null }),
                    )
                  }
                >
                  {t("Zuordnung entfernen")}
                </button>
              ) : property.buildingId ? (
                <span>{t("Bereits einem anderen Haus zugeordnet")}</span>
              ) : (
                <button
                  className="btn-outline"
                  disabled={state.busy}
                  onClick={() =>
                    state.run(() =>
                      updateProperty(property.id, { buildingId: id }),
                    )
                  }
                >
                  {t("Diesem Haus zuordnen")}
                </button>
              )}
            </div>
          </div>
        ))}</>}
      </section>
      <section className="assistant-card">
        <h2>{t("Nebenkostenabrechnungen")}</h2>
        <Link className="btn-primary" to={`/buildings/${id}/statements`}>
          {t("Abrechnungen öffnen")}
        </Link>
      </section>
      <section className="assistant-card">
        <div className="assistant-actions">
          <h2>{t('Hauskosten und Leistungszeiträume')}</h2>
          <button type="button" className="btn-outline" disabled={state.busy} aria-expanded={editingCosts} onClick={() => setEditingCosts(!editingCosts)}>{t(editingCosts ? 'Fertig' : 'Kosten bearbeiten')}</button>
        </div>
        {!editingCosts && <>
          {houseCosts.map(cost => <div className="assistant-row" key={cost.id}>
            <h3>{cost.name}</h3>
            <p>{Number.isFinite(cost.amount) ? new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cost.amount) : t('Noch offen')}</p>
            {(cost.serviceStart || cost.serviceEnd) && <p className="text-muted">{cost.serviceStart || '…'} – {cost.serviceEnd || '…'}</p>}
          </div>)}
          {!houseCosts.length && <p className="text-muted">{t('Noch keine Hauskosten zugeordnet.')}</p>}
        </>}
        {editingCosts && <>{houseCosts.map((cost) => (
            <HouseCost
              key={`${cost.id}-${cost.serviceStart}-${cost.serviceEnd}-${cost.costCategory}`}
              cost={cost}
              onSave={(value) => state.run(() => updateCost(cost.id, value))}
            />
          ))}
        <label className="assistant-field">
          {t("Vorhandene Kosten dem Haus zuordnen")}
          <select
            value=""
            onChange={(event) => {
              if (event.target.value)
                state.run(() =>
                  updateCost(event.target.value, { buildingId: id }),
                );
            }}
          >
            <option value="">{t("Bitte auswählen")}</option>
            {costs
              .filter((cost) => !cost.buildingId)
              .map((cost) => (
                <option key={cost.id} value={cost.id}>
                  {cost.name} · {cost.amount} €
                </option>
              ))}
          </select>
        </label></>}
        <Link to="/costs">{t("Kosten erfassen und Belege zuordnen")}</Link>
      </section>
    </div>
  );
}
function HouseCost({ cost, onSave }) {
  const { t } = useTranslation(),
    [form, setForm] = useState({
      serviceStart: cost.serviceStart || "",
      serviceEnd: cost.serviceEnd || "",
      costCategory: cost.costCategory || "",
    });
  return (
    <form
      className="assistant-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}
    >
      <h3>
        {cost.name} · {cost.amount} €
      </h3>
      <div className="assistant-grid">
        <Field
          label="Leistungsbeginn"
          type="date"
          value={form.serviceStart}
          onChange={(serviceStart) => setForm({ ...form, serviceStart })}
        />
        <Field
          label="Leistungsende"
          type="date"
          value={form.serviceEnd}
          onChange={(serviceEnd) => setForm({ ...form, serviceEnd })}
        />
        <Field
          label="Betriebskostenart"
          value={form.costCategory}
          onChange={(costCategory) => setForm({ ...form, costCategory })}
        />
      </div>
      <button className="btn-outline">{t("Zeitraum speichern")}</button>
    </form>
  );
}
