import * as dns from "dns";
import * as http from "http";
import * as https from "https";
import { isIP } from "net";
import { inspectImage, MAX_IMAGE_BYTES } from "./images";

function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) === 6) {
    const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
    const [first, second = "0"] = canonical.split(":");
    const prefix = parseInt(first, 16);
    // Global unicast only; exclude transition, special-use and documentation ranges.
    return prefix >= 0x2000 && prefix <= 0x3fff && prefix !== 0x2002 &&
      !(prefix === 0x2001 && (parseInt(second, 16) < 0x200 || second === "db8")) &&
      !(prefix === 0x3fff && parseInt(second, 16) <= 0xfff);
  }
  return false;
}

export function validateImageUrl(value: unknown): URL {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) {
    throw new Error("Provider image must be an HTTP(S) URL");
  }
  const url = new URL(value);
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (url.username || url.password || !host || host === "localhost" ||
      host.endsWith(".localhost") || host.endsWith(".local") ||
      (isIP(host) !== 0 && !isPublicAddress(host))) {
    throw new Error("Provider image must use a public URL without credentials");
  }
  return url;
}

// Validate the addresses used by the socket itself, avoiding a separate DNS check
// followed by a second, potentially different resolution inside fetch().
const publicLookup: http.RequestOptions["lookup"] = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      return callback(new Error("Image host resolves to a non-public address"), "", 4);
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
};

export async function downloadImage(value: string) {
  const url = validateImageUrl(value);
  return new Promise<ReturnType<typeof readResult>>((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).get(url, {
      agent: false,
      lookup: publicLookup,
      signal: AbortSignal.timeout(60_000),
    }, async (response) => {
      try {
        // Redirects are deliberately rejected, including redirects to private hosts.
        if (response.statusCode !== 200) throw new Error(`Download failed: HTTP ${response.statusCode}`);
        const size = response.headers["content-length"];
        if (size && (!/^\d+$/.test(size) || Number(size) > MAX_IMAGE_BYTES)) {
          throw new Error("Downloaded image exceeds 20 MiB");
        }
        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of response) {
          const bytes = Buffer.from(chunk);
          total += bytes.length;
          if (total > MAX_IMAGE_BYTES) throw new Error("Downloaded image exceeds 20 MiB");
          chunks.push(bytes);
        }
        resolve(readResult(Buffer.concat(chunks, total)));
      } catch (error) {
        response.destroy();
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function readResult(data: Buffer) {
  return { data, ...inspectImage(data) };
}
