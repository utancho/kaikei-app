import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

// Existing desktop artwork is the single source; never overwrite the master.
const master = await readFile(new URL("../desktop/build/icon.png", import.meta.url));
const directory = new URL("../client/public/brand/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("keirio-icon.png", directory), master);
await writeFile(new URL("apple-touch-icon.png", directory), await sharp(master).resize(180, 180).png().toBuffer());
console.log("Brand icon SHA-256:", createHash("sha256").update(master).digest("hex"));
