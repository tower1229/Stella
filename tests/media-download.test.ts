import { EventEmitter } from "events";
import { Readable } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadImage, validateImageUrl } from "../scripts/media-download";
import { MAX_IMAGE_BYTES } from "../scripts/images";

const network = vi.hoisted(() => ({ get: vi.fn(), lookup: vi.fn() }));
vi.mock("https", () => ({ get: network.get }));
vi.mock("http", () => ({ get: network.get }));
vi.mock("dns", () => ({ lookup: network.lookup }));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

describe("bounded public image download", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });
  function respond(chunks: Buffer[], statusCode = 200, headers = {}) {
    const response = Object.assign(Readable.from(chunks), { statusCode, headers });
    network.get.mockImplementation((_url, _options, receive) => {
      queueMicrotask(() => receive(response));
      return new EventEmitter();
    });
    return response;
  }
  it("derives MIME and extension from bytes instead of server metadata", async () => {
    respond([png], 200, { "content-type": "image/jpeg" });
    await expect(downloadImage("https://cdn.example.com/output.jpg"))
      .resolves.toMatchObject({ data: png, mimeType: "image/png", extension: ".png" });
    expect(network.get.mock.calls[0][1]).toMatchObject({ agent: false, signal: expect.any(AbortSignal) });
  });
  it.each(["http://127.1/x", "http://2130706433/x", "http://0xa9fea9fe/x", "http://10.0.0.1/x", "http://[::1]/x", "http://[::ffff:a9fe:a9fe]/x", "http://[fe80::1]/x", "file:///tmp/private", "https://localhost/x", "https://a.local/x", "https://u:p@example.com/x"])("rejects unsafe addresses before a request: %s", async (url) => {
    await expect(downloadImage(url)).rejects.toThrow();
    expect(network.get).not.toHaveBeenCalled();
  });
  it.each([301, 302, 307, 308])("rejects HTTP %s without following a private redirect", async (status) => {
    const response = respond([], status, { location: "http://169.254.169.254/metadata" });
    await expect(downloadImage("https://cdn.example.com/x")).rejects.toThrow(`HTTP ${status}`);
    expect(network.get).toHaveBeenCalledTimes(1);
    expect(response.destroyed).toBe(true);
  });
  it("rejects an oversized Content-Length before buffering", async () => {
    const response = respond([], 200, { "content-length": String(MAX_IMAGE_BYTES + 1) });
    await expect(downloadImage("https://cdn.example.com/x")).rejects.toThrow("20 MiB");
    expect(response.destroyed).toBe(true);
  });
  it("bounds chunked responses even without Content-Length", async () => {
    const response = respond([Buffer.alloc(MAX_IMAGE_BYTES), Buffer.from("x")]);
    await expect(downloadImage("https://cdn.example.com/x")).rejects.toThrow("20 MiB");
    expect(response.destroyed).toBe(true);
  });
  it("rejects HTML disguised as an image", async () => {
    respond([Buffer.from("<html>not an image</html>")], 200, { "content-type": "image/png" });
    await expect(downloadImage("https://cdn.example.com/x.png")).rejects.toThrow("Unrecognized image");
  });
  it("propagates interrupted response bodies", async () => {
    const stream = new Readable({ read() { this.destroy(new Error("connection reset")); } });
    network.get.mockImplementation((_url, _options, receive) => {
      queueMicrotask(() => receive(Object.assign(stream, { statusCode: 200, headers: {} })));
      return new EventEmitter();
    });
    await expect(downloadImage("https://cdn.example.com/x")).rejects.toThrow("connection reset");
  });
  it.each([false, true])("pins socket lookup to verified public DNS answers (all=%s)", async (all) => {
    respond([png]);
    await downloadImage("https://cdn.example.com/x");
    const lookup = network.get.mock.calls[0][1].lookup;
    const addresses = [{ address: "93.184.216.34", family: 4 }];
    network.lookup.mockImplementation((_host, _options, callback) => callback(null, addresses));
    const callback = vi.fn();
    lookup("cdn.example.com", { all }, callback);
    expect(callback).toHaveBeenCalledWith(null, ...(all ? [addresses] : [addresses[0].address, 4]));
  });
  it.each(["127.0.0.1", "169.254.169.254", "::1", "::ffff:127.0.0.1", "fc00::1", "2001:db8::1"])("rejects private DNS answers on the socket path: %s", async (address) => {
    respond([png]);
    await downloadImage("https://cdn.example.com/x");
    const lookup = network.get.mock.calls[0][1].lookup;
    network.lookup.mockImplementation((_host, _options, callback) => callback(null, [
      { address: "93.184.216.34", family: 4 }, { address, family: address.includes(":") ? 6 : 4 },
    ]));
    const callback = vi.fn();
    lookup("cdn.example.com", { all: true }, callback);
    expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
  });
  it("accepts public IPv6 URLs", () => {
    expect(validateImageUrl("https://[2606:4700::1111]/x").protocol).toBe("https:");
  });
});
