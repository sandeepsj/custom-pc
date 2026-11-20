/** Read-only API over the JSON in data/. No database, no network calls. */
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { compare, machineView as view } from "../shared/compare";
import { evaluate, withPrice } from "../shared/evaluate";
import { Selection, type Machine } from "../shared/schema";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, loadData, type Dataset } from "./data";

const machineView = (m: Machine, d: Dataset) => view(m, d.parts);

const app = new Hono();

app.get("/api/health", async (c) => {
  const d = await loadData();
  return c.json({ counts: { parts: d.parts.size, machines: d.machines.size }, problems: d.problems });
});

app.get("/api/parts", async (c) => {
  const d = await loadData();
  const type = c.req.query("type");
  return c.json([...d.parts.values()].filter((p) => !type || p.type === type).map(withPrice));
});

app.get("/api/parts/:id", async (c) => {
  const p = (await loadData()).parts.get(c.req.param("id"));
  return p ? c.json(withPrice(p)) : c.json({ error: "No such part" }, 404);
});

app.get("/api/machines", async (c) => {
  const d = await loadData();
  return c.json([...d.machines.values()].map((m) => machineView(m, d)));
});

app.get("/api/machines/:id", async (c) => {
  const d = await loadData();
  const m = d.machines.get(c.req.param("id"));
  return m ? c.json(machineView(m, d)) : c.json({ error: "No such machine" }, 404);
});

const IMAGE_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };

/** Pictures stored in data/images/. Only plain filenames are accepted, so nothing outside that folder is reachable. */
app.get("/api/images/:file", async (c) => {
  const file = c.req.param("file");
  const type = IMAGE_TYPES[file.split(".").pop() ?? ""];
  if (!type || !/^[a-z0-9][a-z0-9._-]*$/.test(file)) return c.json({ error: "No such image" }, 404);
  try {
    const body = await readFile(path.join(DATA_DIR, "images", file));
    return c.body(body, 200, { "content-type": type, "cache-control": "max-age=3600", "content-security-policy": "default-src 'none'" });
  } catch {
    return c.json({ error: "No such image" }, 404);
  }
});

/** Compare any two machines. The rows are generated from their JSON on each request. */
app.get("/api/compare", async (c) => {
  const d = await loadData();
  const a = d.machines.get(c.req.query("a") ?? "");
  const b = d.machines.get(c.req.query("b") ?? "");
  if (!a || !b) return c.json({ error: "Pass two machine ids as ?a= and ?b=" }, 404);
  return c.json(compare(machineView(a, d), machineView(b, d)));
});

/** Price and check any selection of parts. The builder page posts its current picks here. */
app.post("/api/evaluate", async (c) => {
  const parsed = Selection.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid selection", issues: parsed.error.issues }, 400);
  return c.json(evaluate(parsed.data, (await loadData()).parts));
});

if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist" }));
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`API on http://localhost:${port}`));
