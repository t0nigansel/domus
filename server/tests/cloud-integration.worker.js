// This entrypoint is used only by the isolated integration harness.
import worker from '../cloud/worker.js';
import { WorkflowEntrypoint } from 'cloudflare:workers';
import {runAssistant} from '../cloud/assistant-runner.js';
export class AssistantWorkflow extends WorkflowEntrypoint {
    async run(event,step) {
        await runAssistant(this.env,event.payload,step,async(env,html)=>{
            if(env.DOMUS_ENV!=='test'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(env.TEST_PDF_URL))throw new Error('Test renderer unavailable');
            const response=await fetch(env.TEST_PDF_URL,{method:'POST',headers:{Authorization:env.TEST_PDF_TOKEN},body:html});
            if(!response.ok)throw new Error('Test PDF renderer failed');
            return Buffer.from(await response.arrayBuffer());
        });
    }
}

const messages = [];
export default {
    async fetch(request, env, context) {
        if (new URL(request.url).pathname === '/__test/mail') return Response.json(messages);
        if(new URL(request.url).pathname==='/__test/files')return Response.json(await env.FILES.list({prefix:new URL(request.url).searchParams.get('prefix')||''}));
        return worker.fetch(request, {
            ...env,
            BETTER_AUTH_URL: new URL(request.url).origin,
            EMAIL: { send: async message => { messages.push(message); return { messageId: 'local-captured-message' }; } },
        }, context);
    },
};
