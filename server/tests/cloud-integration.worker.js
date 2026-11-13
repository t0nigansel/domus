// This entrypoint is used only by the isolated integration harness.
import worker from '../cloud/worker.js';

const messages = [];
export default {
    async fetch(request, env, context) {
        if (new URL(request.url).pathname === '/__test/mail') return Response.json(messages);
        return worker.fetch(request, {
            ...env,
            BETTER_AUTH_URL: new URL(request.url).origin,
            EMAIL: { send: async message => { messages.push(message); return { messageId: 'local-captured-message' }; } },
        }, context);
    },
};
