import { WorkflowEntrypoint } from "cloudflare:workers";
import { runAssistant } from "./assistant-runner.js";

export class AssistantWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    await runAssistant(this.env, event.payload, step);
  }
}
