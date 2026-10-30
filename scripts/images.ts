import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// Inspect content rather than trusting a filename or a server's Content-Type.
// This checks format signatures, not a full image decode.
export function inspectImage(data: Buffer): { mimeType: string; extension: string } {
  if (data.length === 0 || data.length > MAX_IMAGE_BYTES) {
    throw new Error("Image must contain between 1 byte and 20 MiB");
  }
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) &&
      data.toString("ascii", 12, 16) === "IHDR" && data.readUInt32BE(16) > 0 && data.readUInt32BE(20) > 0) {
    return { mimeType: "image/png", extension: ".png" };
  }
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: ".jpg" };
  }
  if (data.length >= 16 && data.toString("ascii", 0, 4) === "RIFF" &&
      data.toString("ascii", 8, 12) === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(data.toString("ascii", 12, 16))) {
    return { mimeType: "image/webp", extension: ".webp" };
  }
  if (data.length >= 10 && ["GIF87a", "GIF89a"].includes(data.toString("ascii", 0, 6))) {
    return { mimeType: "image/gif", extension: ".gif" };
  }
  if (data.length >= 16 && data.toString("ascii", 4, 8) === "ftyp" &&
      ["avif", "avis"].includes(data.toString("ascii", 8, 12))) {
    return { mimeType: "image/avif", extension: ".avif" };
  }
  throw new Error("Unrecognized image content");
}

function contains(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function avatarRoots(): string[] {
  const configured = process.env.AvatarAllowedRoots;
  if (configured) {
    const roots: unknown = JSON.parse(configured);
    if (!Array.isArray(roots) || roots.length === 0 ||
        !roots.every((root) => typeof root === "string" && path.isAbsolute(root))) {
      throw new Error("AvatarAllowedRoots must be a JSON array of absolute directory paths");
    }
    return roots.map((root: string) => fs.realpathSync(root));
  }
  const workspace = fs.realpathSync(path.join(os.homedir(), ".openclaw", "workspace"));
  // Do not implicitly authorize an avatars/assets symlink pointing outside the workspace.
  return [path.join(workspace, "avatars"), path.join(workspace, "assets")];
}

export function readImageFile(filePath: string, allowedRoots?: string[]) {
  const real = fs.realpathSync(filePath);
  const checkRoot = () => {
    if (allowedRoots && !allowedRoots.some((root) => contains(root, real))) {
      throw new Error("Avatar is outside the authorized image directories");
    }
    if (fs.realpathSync(filePath) !== real) throw new Error("Image path changed during validation");
  };
  checkRoot();
  const fd = fs.openSync(real, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    checkRoot();
    const stat = fs.fstatSync(fd);
    const current = fs.statSync(real);
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_IMAGE_BYTES ||
        stat.dev !== current.dev || stat.ino !== current.ino) {
      throw new Error("Image must be a regular file no larger than 20 MiB");
    }
    // Bounded reads also handle a file growing after fstat without unbounded allocation.
    const buffer = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const read = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (read === 0) break;
      length += read;
    }
    if (length !== stat.size) throw new Error("Image size changed during validation");
    const data = buffer.subarray(0, length);
    return { data, ...inspectImage(data) };
  } finally {
    fs.closeSync(fd);
  }
}

export function readReferenceImage(filePath: string) {
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(filePath).toLowerCase())) {
    throw new Error("Avatar must use jpg, jpeg, png or webp format");
  }
  const image = readImageFile(filePath, avatarRoots());
  if (!["image/jpeg", "image/png", "image/webp"].includes(image.mimeType)) {
    throw new Error("Unsupported avatar image format");
  }
  return image;
}
