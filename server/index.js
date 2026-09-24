import app from './app.js';

const PORT = Number(process.env.PORT) || 3001;
// Listen on loopback only so the API isn't reachable from other devices.
// Set HOST=0.0.0.0 to expose it on the network (it has no authentication).
const HOST = process.env.HOST || '127.0.0.1';

app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Documentation available at http://localhost:${PORT}/api-docs`);
});
