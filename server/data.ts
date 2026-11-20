/** Reads and validates everything under data/. Called on every request so JSON edits show up on refresh. */
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import { Machine, Part, PART_TYPES } from "../shared/schema";

export const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");

export interface Problem {
  file: string;
  message: string;
}

export interface Dataset {
  parts: Map<string, Part>;
  machines: Map<string, Machine>;
  problems: Problem[];
}

async function loadDir<S extends z.ZodType<{ id: string }>>(
  dir: string,
  schema: S,
  problems: Problem[],
  extra?: (item: z.infer<S>) => string | null,
): Promise<Map<string, z.infer<S>>> {
  const out = new Map<string, z.infer<S>>();
  let names: string[] = [];
  try {
    names = (await readdir(path.join(DATA_DIR, dir))).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return out;
  }
  for (const name of names) {
    const file = `data/${dir}/${name}`;
    try {
      const parsed = schema.safeParse(JSON.parse(await readFile(path.join(DATA_DIR, dir, name), "utf8")));
      if (!parsed.success) {
        for (const issue of parsed.error.issues)
          problems.push({ file, message: `${issue.path.join(".") || "(root)"}: ${issue.message}` });
        continue;
      }
      const item = parsed.data;
      if (item.id !== name.replace(/\.json$/, "")) {
        problems.push({ file, message: `id "${item.id}" must match the filename` });
        continue;
      }
      const err = extra?.(item);
      if (err) {
        problems.push({ file, message: err });
        continue;
      }
      out.set(item.id, item);
    } catch (e) {
      problems.push({ file, message: `not valid JSON: ${(e as Error).message}` });
    }
  }
  return out;
}

export async function loadData(): Promise<Dataset> {
  const problems: Problem[] = [];
  const parts = new Map<string, Part>();
  for (const type of PART_TYPES) {
    const loaded = await loadDir(`parts/${type}`, Part, problems, (p) =>
      p.type !== type ? `type "${p.type}" does not belong in parts/${type}/` : null,
    );
    for (const [id, p] of loaded) {
      if (parts.has(id)) problems.push({ file: `data/parts/${type}/${id}.json`, message: `duplicate part id "${id}"` });
      else parts.set(id, p);
    }
  }
  const machines = await loadDir("machines", Machine, problems);

  // Every part id a machine names must exist and be the right type.
  for (const m of machines.values()) {
    const s = m.parts;
    const refs: [string, string | undefined][] = [
      ["cpu", s.cpu], ["motherboard", s.motherboard], ["gpu", s.gpu], ["psu", s.psu], ["case", s.case],
      ["cooler", s.cooler], ["wifi", s.wifi], ["display", s.display], ["battery", s.battery], ["ups", s.ups],
      ...s.ram.map((r) => ["ram", r.id] as [string, string]),
      ...s.storage.map((r) => ["storage", r.id] as [string, string]),
    ];
    for (const [slot, id] of refs) {
      if (!id) continue;
      const p = parts.get(id);
      const file = `data/machines/${m.id}.json`;
      if (!p) problems.push({ file, message: `${slot} "${id}" does not exist in data/parts/${slot}/` });
      else if (p.type !== slot) problems.push({ file, message: `${slot} "${id}" is a ${p.type}` });
    }
  }
  // Every image named must be a file in data/images/.
  const withImage = [
    ...[...parts.values()].map((p) => ({ file: `data/parts/${p.type}/${p.id}.json`, image: p.image })),
    ...[...machines.values()].map((m) => ({ file: `data/machines/${m.id}.json`, image: m.image })),
  ];
  for (const { file, image } of withImage) {
    if (!image) continue;
    await access(path.join(DATA_DIR, "images", image.file)).catch(() =>
      problems.push({ file, message: `image "${image.file}" is not in data/images/` }),
    );
  }
  return { parts, machines, problems };
}
