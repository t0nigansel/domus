import { useState } from 'react';
import { fileService } from '../../db/services/fileService';

export function useFileWorkspace(onRefresh) {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [rawFiles, setRawFiles] = useState(null);
    async function run(action) {
        setBusy(true); setError(''); setMessage('');
        try { await action(); } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    }
    return {
        busy, message, error, rawFiles,
        scan: () => run(async () => setRawFiles(await fileService.listRaw())),
        upload: (files, metadata) => run(async () => {
            let added = 0;
            let duplicates = 0;
            try {
                for (const file of files) {
                    const result = await fileService.upload(file, metadata);
                    if (result.duplicate) duplicates++; else added++;
                }
            } finally {
                await onRefresh();
                setMessage(`${added} Datei(en) gespeichert, ${duplicates} bereits vorhanden.`);
            }
        }),
        importRaw: (path, metadata) => run(async () => {
            const result = await fileService.importRaw({ path, ...metadata });
            await onRefresh();
            setMessage(result.duplicate ? 'Datei ist dieser Wohnung bereits zugeordnet.' : 'Datei importiert. Das Original bleibt unverändert.');
        }),
        update: (id, metadata) => run(async () => {
            await fileService.update(id, metadata);
            await onRefresh();
            setMessage('Dokumentangaben gespeichert.');
        }),
    };
}
