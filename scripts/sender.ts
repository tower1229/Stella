import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface SendMessageOptions {
  channel: string;
  target: string;
  media?: string;
  message?: string;
  gatewayToken?: string;
  gatewayUrl?: string;
}

/**
 * Send a message to an OpenClaw channel.
 *
 * Tries the `openclaw` CLI first (OpenClaw 2026.3.13 format).
 * Falls back to direct HTTP POST to the gateway if CLI is unavailable.
 */
export async function sendMessage(options: SendMessageOptions): Promise<void> {
  const {
    channel,
    target,
    media,
    message = "",
    gatewayToken,
    gatewayUrl = "http://localhost:18789",
  } = options;

  try {
    await sendViaCLI({ channel, target, media, message });
  } catch (cliErr) {
    console.warn(
      `[stella] CLI send failed (${(cliErr as Error).message}), trying HTTP fallback...`
    );
    await sendViaHTTP({ channel, target, media, message, gatewayToken, gatewayUrl });
  }
}

/**
 * Backward-compatible image send helper.
 */
export async function sendImage(options: {
  channel: string;
  target: string;
  media: string;
  message?: string;
  gatewayToken?: string;
  gatewayUrl?: string;
}): Promise<void> {
  await sendMessage(options);
}

/**
 * Send via `openclaw message send` CLI (OpenClaw 2026.3.13).
 * Command format:
 *   openclaw message send --channel <provider> --target <destination> [--message <caption>] [--media <url_or_path>]
 */
async function sendViaCLI(options: {
  channel: string;
  target: string;
  media?: string;
  message: string;
}): Promise<void> {
  const { channel, target, media, message } = options;

  const parts = [
    "openclaw message send",
    `--channel ${shellEscape(channel)}`,
    `--target ${shellEscape(target)}`,
  ];

  if (media) {
    parts.push(`--media ${shellEscape(media)}`);
  }

  if (message) {
    parts.push(`--message ${shellEscape(message)}`);
  }

  const cmd = parts.join(" ");
  console.log(`[stella] Running: ${cmd}`);

  const { stdout, stderr } = await execAsync(cmd);
  if (stdout) console.log(`[stella] CLI stdout: ${stdout.trim()}`);
  if (stderr) console.warn(`[stella] CLI stderr: ${stderr.trim()}`);
}

/**
 * Send via direct HTTP POST to the OpenClaw gateway.
 */
async function sendViaHTTP(options: {
  channel: string;
  target: string;
  media?: string;
  message: string;
  gatewayToken?: string;
  gatewayUrl: string;
}): Promise<void> {
  const { channel, target, media, message, gatewayToken, gatewayUrl } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (gatewayToken) {
    headers["Authorization"] = `Bearer ${gatewayToken}`;
  }

  const payload: Record<string, string> = {
    action: "send",
    channel,
    target,
    message,
  };
  if (media) {
    payload.media = media;
  }
  const body = JSON.stringify(payload);

  const url = `${gatewayUrl}/message`;
  console.log(`[stella] HTTP POST: ${url}`);

  const response = await fetch(url, { method: "POST", headers, body });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `OpenClaw HTTP send failed (${response.status}): ${text}`
    );
  }
}

/**
 * Minimal shell argument escaping: wrap in single quotes, escape embedded single quotes.
 */
function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
