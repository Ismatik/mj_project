import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const PUBLIC = "11111111-2222-3333-4444-555555555555.png";
const PRIVATE = "99999999-8888-7777-6666-555555555555.png";

let readMedia: typeof import("./media").readMedia;

beforeAll(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "mj-media-"));
  await writeFile(path.join(dir, PUBLIC), PNG);
  await mkdir(path.join(dir, "private"), { recursive: true });
  await writeFile(path.join(dir, "private", PRIVATE), PNG);
  await writeFile(path.join(dir, "secret.txt"), "not an image");
  process.env.MEDIA_DIR = dir; // MEDIA_DIR is read at import time
  ({ readMedia } = await import("./media"));
});

// readMedia is what /media/[name] serves; the route itself only wraps it in a response.
describe("readMedia", () => {
  it("serves a photo uploaded in the site admin", async () => {
    const f = await readMedia(PUBLIC);
    expect(f?.mime).toBe("image/png");
    expect(f?.body.equals(PNG)).toBe(true);
  });

  it("cannot reach a guest's private photo", async () => {
    expect(await readMedia(`private/${PRIVATE}`)).toBeNull();
  });

  // The name is joined onto a path, so traversal has to die in MEDIA_NAME.
  it.each(["../.env", "../../etc/passwd", "secret.txt", `${PUBLIC}/../../.env`, "11111111-2222-3333-4444-555555555555.php"])("refuses %s", async (name) => {
    expect(await readMedia(name)).toBeNull();
  });

  it("is null for a well-formed name that is not there", async () => {
    expect(await readMedia("00000000-0000-0000-0000-000000000000.jpg")).toBeNull();
  });
});
