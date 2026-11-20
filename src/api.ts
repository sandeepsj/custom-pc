import { useEffect, useState } from "react";
import { compare, machineView } from "../shared/compare";
import { evaluate, withPrice, type Evaluated, type Priced } from "../shared/evaluate";
import type { CompareRow, CompareView, MachineView } from "../shared/compare";
import type { Machine, Part, Selection } from "../shared/schema";

export type { CompareRow, CompareView, Evaluated, MachineView, Selection };
export type PricedPart = Priced<Part>;

export interface Health {
  counts: Record<string, number>;
  problems: { file: string; message: string }[];
}

/**
 * Static mode (GitHub Pages): there is no API server, so the same shared code that the server runs
 * answers each request in the browser from one data.json written at build time.
 */
const STATIC = import.meta.env.VITE_STATIC === "1";

export const imageUrl = (file: string) => (STATIC ? `images/${file}` : `/api/images/${file}`);

interface Bundle {
  parts: Part[];
  machines: Machine[];
  problems: Health["problems"];
}
let bundle: Promise<{ raw: Bundle; parts: Map<string, Part>; machines: Map<string, Machine> }> | undefined;

async function local(url: string, init?: RequestInit): Promise<unknown> {
  bundle ??= fetch("data.json").then(async (r) => {
    if (!r.ok) throw new Error(`data.json answered ${r.status}`);
    const raw = (await r.json()) as Bundle;
    return { raw, parts: new Map(raw.parts.map((p) => [p.id, p])), machines: new Map(raw.machines.map((m) => [m.id, m])) };
  });
  const d = await bundle;
  const u = new URL(url, "http://local");
  const views = () => d.raw.machines.map((m) => machineView(m, d.parts));
  switch (u.pathname) {
    case "/api/health":
      return { counts: { parts: d.parts.size, machines: d.machines.size }, problems: d.raw.problems };
    case "/api/parts":
      return d.raw.parts.map(withPrice);
    case "/api/machines":
      return views();
    case "/api/compare": {
      const [a, b] = [d.machines.get(u.searchParams.get("a") ?? ""), d.machines.get(u.searchParams.get("b") ?? "")];
      if (!a || !b) throw new Error("No such machine");
      return compare(machineView(a, d.parts), machineView(b, d.parts));
    }
    case "/api/evaluate":
      return evaluate(JSON.parse(String(init?.body)) as Selection, d.parts);
  }
  throw new Error(`${url} is not available`);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  if (STATIC) return local(url, init) as Promise<T>;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json() as Promise<T>;
}

export const evaluateSelection = (sel: Selection) =>
  request<Evaluated>("/api/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sel),
  });

/** Fetch JSON once per url. */
export function useApi<T>(url: string) {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    let live = true;
    setState({});
    request<T>(url).then(
      (data) => live && setState({ data }),
      (e: Error) => live && setState({ error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}
