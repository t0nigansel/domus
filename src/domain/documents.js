// Dokumentnamen: von Oberfläche, lokalem Server und Cloud gemeinsam genutzt.
const failure = (message) => Object.assign(new Error(message), { status: 400 });

// Endung inklusive Punkt, z. B. ".pdf"; leer, wenn der Name keine hat.
export function fileExtension(name) {
    const match = /(\.[A-Za-z0-9]{1,8})$/.exec(name || '');
    return match && match.index > 0 ? match[1] : '';
}

export function splitDocumentName(name) {
    const extension = fileExtension(name);
    return { base: extension ? name.slice(0, -extension.length) : (name || ''), extension };
}

// Prüft einen neuen Namen. Die Endung der gespeicherten Datei bleibt immer erhalten,
// damit Download und Vorschau weiter zum Dateiinhalt passen.
export function renameDocument(input, originalName) {
    if (typeof input !== 'string') throw failure('Ungültiger Dokumentname.');
    const extension = fileExtension(originalName);
    let name = input.trim();
    if (extension && name.toLowerCase().endsWith(extension.toLowerCase())) name = name.slice(0, -extension.length).trim();
    // eslint-disable-next-line no-control-regex
    if (!name || /[\\/\x00-\x1f\x7f]/.test(name)) throw failure('Bitte einen gültigen Dokumentnamen ohne / oder \\ angeben.');
    const full = name + extension;
    if (full.length > 240) throw failure('Der Dokumentname ist zu lang.');
    return full;
}

// Dokumentkategorien mit deutschem Anzeigenamen (wird über t() übersetzt).
export const DOCUMENT_CATEGORIES = { Misc: 'Sonstiges', Photos: 'Fotos', FloorPlans: 'Grundrisse', Energy: 'Energieausweise', Leases: 'Mietverträge', Invoices: 'Rechnungen', Insurance: 'Versicherungen' };
