// Real-process fixture: hold both workers immediately before creating the shared parent.
const fs = require("node:fs");
const path = require("node:path");
const { prepareChat } = require(process.argv[2]);
const { request, state } = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const workspace = fs.realpathSync(state.agents[0].workspace);
const gate = path.join(workspace, "mkdir-start");
const mkdir = fs.mkdirSync;
let waiting = true;
fs.mkdirSync = function (directory, ...options) {
  if (waiting && directory === path.join(workspace, "stella-selfie")) {
    waiting = false;
    process.send({ ready: true });
    const deadline = Date.now() + 5000;
    while (!fs.existsSync(gate)) {
      if (Date.now() > deadline) throw new Error("Concurrent preparation barrier timed out.");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  return mkdir(directory, ...options);
};
try {
  const result = prepareChat(request, state);
  process.send({ ok: true, referenceToken: result.referenceToken, images: result.toolInput.images });
} catch (error) {
  process.send({ ok: false, code: error.code, message: error.message });
} finally {
  process.disconnect();
}
