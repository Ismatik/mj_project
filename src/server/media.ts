import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Uploaded photos live in MEDIA_DIR (a Docker volume in production) and are served by /media/[name].

export const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || "./media");
const MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_NAME = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;

const TYPES: { ext: "jpg" | "png" | "webp"; mime: string; test: (b: Buffer) => boolean }[] = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "webp", mime: "image/webp", test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
];

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/** Accepts JPEG, PNG or WebP up to 8 MB, detected by content (not by the file name). */
export async function saveUpload(file: File | null): Promise<UploadResult> {
  if (!file || typeof file === "string" || file.size === 0) return { ok: false, error: "Выберите файл" };
  if (file.size > MAX_BYTES) return { ok: false, error: "Файл больше 8 МБ" };
  const buf = Buffer.from(await file.arrayBuffer());
  const type = TYPES.find((t) => t.test(buf));
  if (!type) return { ok: false, error: "Нужен JPG, PNG или WebP" };
  await mkdir(MEDIA_DIR, { recursive: true });
  const name = `${randomUUID()}.${type.ext}`;
  await writeFile(path.join(MEDIA_DIR, name), buf);
  return { ok: true, url: `/media/${name}` };
}

export async function readMedia(name: string): Promise<{ body: Buffer; mime: string } | null> {
  if (!MEDIA_NAME.test(name)) return null;
  try {
    const body = await readFile(path.join(MEDIA_DIR, name));
    const ext = name.split(".").pop();
    return { body, mime: TYPES.find((t) => t.ext === ext)!.mime };
  } catch {
    return null;
  }
}
