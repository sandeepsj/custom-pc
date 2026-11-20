/** Writes the data bundle and images into dist/ so the built site works with no server (GitHub Pages). */
import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, loadData } from "../server/data";

const d = await loadData();
if (d.problems.length) {
  for (const p of d.problems) console.error(`${p.file}: ${p.message}`);
  process.exit(1);
}
const dist = path.resolve(DATA_DIR, "../dist");
await mkdir(dist, { recursive: true });
await writeFile(
  path.join(dist, "data.json"),
  JSON.stringify({ parts: [...d.parts.values()], machines: [...d.machines.values()], problems: [] }),
);
await cp(path.join(DATA_DIR, "images"), path.join(dist, "images"), { recursive: true }).catch(() => {});
console.log(`Wrote ${d.parts.size} parts and ${d.machines.size} machines to dist/data.json`);
