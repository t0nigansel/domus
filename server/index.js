import app from './app.js';
import { config } from './config.js';

// Binds to 127.0.0.1 unless HOST says otherwise (the API has no authentication yet).
app.listen(config.port, config.host, () => {
    console.log(`Server is running on http://localhost:${config.port}`);
    console.log(`Documentation available at http://localhost:${config.port}/api-docs`);
});
