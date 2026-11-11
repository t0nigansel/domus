import './CloudApp.css';

export default function CloudApp() {
    return (
        <main className="cloud-welcome">
            <img src="/logo.svg" alt="" width="56" height="56" />
            <p className="cloud-brand">DOMUS</p>
            <h1>Deine Immobilien.<br />Alles an einem Ort.</h1>
            <p>Der Zugang wird vorbereitet. Bald kannst du hier deine Objekte verwalten.</p>
            <span className="cloud-pilot">Geschlossene Pilotphase</span>
        </main>
    );
}
