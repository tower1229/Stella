import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readReferenceImage } from "../scripts/images";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
describe("reference authorization boundary", () => {
  let root: string, allowed: string, avatar: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "stella-boundary-"));
    allowed = path.join(root, "avatars"); fs.mkdirSync(allowed);
    avatar = path.join(allowed, "main.png"); fs.writeFileSync(avatar, png);
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  it("returns validated bytes only when an explicit Agent root authorizes them", () => {
    expect(readReferenceImage(avatar, [allowed]).data).toEqual(png);
    expect(() => readReferenceImage(avatar)).toThrow("Explicit Agent");
  });
  it("rejects sibling-prefix directories and a valid image outside the authorized root", () => {
    const sibling = path.join(root, "avatars-private"); fs.mkdirSync(sibling);
    const file = path.join(sibling, "private.png"); fs.writeFileSync(file, png);
    expect(() => readReferenceImage(file, [allowed])).toThrow("outside");
  });
  it("rejects an outward directory junction, including after a previously valid read", () => {
    const nested = path.join(allowed, "nested"); fs.mkdirSync(nested);
    const file = path.join(nested, "ref.png"); fs.writeFileSync(file, png);
    expect(readReferenceImage(file, [allowed]).data).toEqual(png);
    const external = path.join(root, "private"); fs.mkdirSync(external); fs.writeFileSync(path.join(external, "ref.png"), png);
    fs.rmSync(nested, { recursive: true }); fs.symlinkSync(external, nested, "junction");
    expect(() => readReferenceImage(file, [allowed])).toThrow("outside");
  });
  it("rejects forged extensions, disallowed reference formats, oversized and nonregular files", () => {
    fs.writeFileSync(avatar, "private text");
    expect(() => readReferenceImage(avatar, [allowed])).toThrow();
    const txt = path.join(allowed, "ref.txt"); fs.writeFileSync(txt, png);
    expect(() => readReferenceImage(txt, [allowed])).toThrow("format");
    fs.truncateSync(avatar, 20 * 1024 * 1024 + 1);
    expect(() => readReferenceImage(avatar, [allowed])).toThrow("20 MiB");
    const directory = path.join(allowed, "directory.png"); fs.mkdirSync(directory);
    expect(() => readReferenceImage(directory, [allowed])).toThrow();
  });
});
