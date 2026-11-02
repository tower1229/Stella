import { InputError } from "./bili";
import { prepareChat, readChatState, releaseReferences } from "./chat";
import { localActionHint, normalizeNativeError } from "./errors";

export const SMOKE_PROMPTS = [
  "A mirror selfie of this person, wearing a casual outfit at home, showing full body reflection.",
  "A selfie of this person, seated by a cafe window, looking into the lens.",
  "A natural third-person photo of this person, walking along a riverside, natural composition, not a selfie.",
];
async function main() {
  const [flag, agentId, ...extra] = process.argv.slice(2);
  if (flag !== "--agent" || !agentId || extra.length) throw new Error("Use smoke.js --agent <id>; smoke prepares references only and never generates images.");
  const state = await readChatState(agentId);
  const agent = state.agents.find(a => a.id === agentId)!;
  for (const prompt of SMOKE_PROMPTS) {
    const prepared = prepareChat({ schemaVersion: 1, agentId, prompt }, state);
    releaseReferences(agent, prepared.referenceToken);
    console.log(JSON.stringify({ ok: true, agentId, model: prepared.toolInput.model, references: prepared.toolInput.images.length, resolution: prepared.toolInput.resolution, generationRequested: false }));
  }
}
if (require.main === module) main().catch(error => {
  console.error(JSON.stringify(error instanceof InputError
    ? { code: error.code, message: error.message, actionHint: localActionHint(error.code) }
    : normalizeNativeError(error)));
  process.exitCode = 1;
});
