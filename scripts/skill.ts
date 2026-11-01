import * as fs from "node:fs";
import { InputError } from "./bili";
import { prepareChat, readChatState, releaseReferences } from "./chat";
import { readAgentLocations } from "./native-cli";
import { normalizeNativeError } from "./errors";

export async function runSkill(args: string[] = process.argv.slice(2)) {
  if (args.length === 2 && args[0] === "prepare") {
    const stat = fs.statSync(args[1]);
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new InputError("INPUT_INVALID", "Input must be a JSON file no larger than 2 MiB.");
    let request;
    try { request = JSON.parse(fs.readFileSync(args[1], "utf8")); }
    catch { throw new InputError("INPUT_INVALID", "Invalid request JSON."); }
    if (!request || typeof request.agentId !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(request.agentId)) {
      throw new InputError("INPUT_INVALID", "Specify the actual conversation Agent; chat has no default Agent.");
    }
    return prepareChat(request, await readChatState(request.agentId));
  }
  if (args.length === 3 && args[0] === "release") {
    const agent = (await readAgentLocations()).find(a => a.id === args[1]);
    if (!agent) throw new InputError("AGENT_NOT_FOUND", "The conversation Agent does not exist.");
    return releaseReferences(agent, args[2]);
  }
  throw new InputError("INPUT_INVALID", "Use: skill.js prepare <request.json> or skill.js release <agentId> <referenceToken>. Legacy targets, batches and save-dir are unsupported.");
}

if (require.main === module) {
  runSkill().then(result => console.log(JSON.stringify(result))).catch(error => {
    const safe = normalizeNativeError(error);
    console.log(JSON.stringify({ schemaVersion: 1, ok: false, error: error instanceof InputError
      ? { code: error.code, message: error.message } : safe }));
    process.exitCode = error instanceof InputError ? 2 : 1;
  });
}
