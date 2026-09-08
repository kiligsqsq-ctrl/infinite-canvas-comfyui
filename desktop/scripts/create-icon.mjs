import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.resolve(desktopDir, "../web/public/logo.svg"));
const buildDir = path.join(desktopDir, "build");
await mkdir(buildDir, { recursive: true });

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = await Promise.all(sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()));
await writeFile(path.join(buildDir, "icon.png"), await sharp(source).resize(512, 512).png().toBuffer());
await writeFile(path.join(buildDir, "icon.ico"), await pngToIco(pngs));
