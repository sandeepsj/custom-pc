/**
 * Builds a comparison of any two machines from their data alone. Nothing here is hand-written per pair:
 * the summary comes from the evaluated totals, and each part section lines up the raw spec fields.
 */
import { bestPrice, evaluate, type Evaluated, type Price } from "./evaluate";
import { BETTER, KIND_LABEL, money, partName, PART_TYPES, showValue, sizeGB, SPEC_LABELS, TYPE_LABEL } from "./labels";
import type { Machine, Part } from "./schema";

export interface MachinePrice {
  amount: number;
  currency: string;
  /** listing = the whole machine is sold at this price. parts = sum of its parts. */
  source: "listing" | "parts";
  seller?: string;
  url?: string;
  inStock?: boolean;
}

export interface MachineView extends Machine {
  evaluated: Evaluated;
  price: MachinePrice | null;
  unitPrice: Price | null;
}

/** Resolve a machine's parts, run the checks and work out its price. */
export function machineView(m: Machine, parts: Map<string, Part>): MachineView {
  const evaluated = evaluate(m.parts, parts);
  // Assembly steps only make sense for something you put together yourself.
  if (m.kind !== "custom") evaluated.steps = [];
  const unitPrice = bestPrice(m.listings);
  const price: MachinePrice | null = unitPrice
    ? { amount: unitPrice.amount, currency: unitPrice.currency, source: "listing", seller: unitPrice.seller, url: unitPrice.url, inStock: unitPrice.inStock }
    : evaluated.total
      ? { ...evaluated.total, source: "parts" }
      : null;
  return { ...m, evaluated, price, unitPrice };
}

export interface CompareRow {
  label: string;
  a: string;
  b: string;
  better?: "a" | "b";
}

export interface CompareSection {
  title: string;
  rows: CompareRow[];
}

export interface CompareView {
  a: MachineView;
  b: MachineView;
  /** a minus b. Negative means a is cheaper. Null when either has no price or currencies differ. */
  priceDelta: { amount: number; currency: string } | null;
  summary: CompareRow[];
  sections: CompareSection[];
}

const pick = (x: number | null | undefined, y: number | null | undefined, dir: "higher" | "lower"): CompareRow["better"] => {
  if (x == null || y == null || x === y) return undefined;
  return (dir === "higher" ? x > y : x < y) ? "a" : "b";
};

const free = (u: { used: number; total: number } | null) => (u ? Math.max(u.total - u.used, 0) : null);

function summaryRows(a: MachineView, b: MachineView): CompareRow[] {
  const [x, y] = [a.evaluated, b.evaluated];
  const [s, t] = [x.summary, y.summary];
  const price = (m: MachineView) =>
    m.price ? `${money(m.price.amount, m.price.currency)}${m.price.source === "parts" ? " (sum of parts)" : ""}` : "No price";
  const sameCurrency = a.price && b.price && a.price.currency === b.price.currency;
  const fixed = (m: MachineView) => m.evaluated.lines.some((l) => l.slot === "cpu" && l.part?.replaceable === false);
  const gpuSlot = (m: MachineView) => {
    const mb = m.evaluated.lines.find((l) => l.slot === "motherboard")?.part;
    return mb?.type === "motherboard" ? mb.specs.pcieX16Slots > 0 : false;
  };
  const yesNo = (v: boolean) => (v ? "Yes" : "No");
  const flag = (p: boolean, q: boolean): CompareRow["better"] => (p === q ? undefined : p ? "a" : "b");
  const portable = (m: MachineView) => (m.kind === "laptop" ? "Yes, with screen and battery" : m.kind === "minipc" ? "Easy to move, needs a screen" : "No, it stays on the desk");
  const rank = { laptop: 2, minipc: 1, custom: 0 };
  const slots = (n: number | null) => (n === null ? "Unknown" : `${n}`);

  return [
    { label: "Kind", a: KIND_LABEL[a.kind], b: KIND_LABEL[b.kind] },
    { label: "Price", a: price(a), b: price(b), better: sameCurrency ? pick(a.price!.amount, b.price!.amount, "lower") : undefined },
    { label: "Processor", a: s.cpu ?? "None", b: t.cpu ?? "None" },
    { label: "Cores", a: showValue(s.cores), b: showValue(t.cores), better: pick(s.cores, t.cores, "higher") },
    { label: "Threads", a: showValue(s.threads), b: showValue(t.threads), better: pick(s.threads, t.threads, "higher") },
    { label: "Memory", a: `${s.ramGB} GB ${s.ramType ?? ""}`.trim(), b: `${t.ramGB} GB ${t.ramType ?? ""}`.trim(), better: pick(s.ramGB, t.ramGB, "higher") },
    { label: "Storage", a: `${sizeGB(s.storageGB)} ${s.storageType ?? ""}`.trim(), b: `${sizeGB(t.storageGB)} ${t.storageType ?? ""}`.trim(), better: pick(s.storageGB, t.storageGB, "higher") },
    { label: "Graphics", a: s.gpu ?? "None", b: t.gpu ?? "None" },
    { label: "Wi-Fi", a: s.wifi ?? "None", b: t.wifi ?? "None" },
    { label: "Bluetooth", a: s.bluetooth ?? "None", b: t.bluetooth ?? "None" },
    { label: "Screen", a: s.display ?? "None, needs a monitor", b: t.display ?? "None, needs a monitor", better: flag(!!s.display, !!t.display) },
    { label: "Battery", a: s.batteryWh ? `${s.batteryWh} Wh` : "None", b: t.batteryWh ? `${t.batteryWh} Wh` : "None", better: flag(!!s.batteryWh, !!t.batteryWh) },
    { label: "Free memory slots", a: slots(free(x.usage.ramSlots)), b: slots(free(y.usage.ramSlots)), better: pick(free(x.usage.ramSlots), free(y.usage.ramSlots), "higher") },
    { label: "Free M.2 slots", a: slots(free(x.usage.m2)), b: slots(free(y.usage.m2)), better: pick(free(x.usage.m2), free(y.usage.m2), "higher") },
    { label: "Free SATA ports", a: slots(free(x.usage.sata)), b: slots(free(y.usage.sata)), better: pick(free(x.usage.sata), free(y.usage.sata), "higher") },
    { label: "Processor can be swapped", a: yesNo(!fixed(a)), b: yesNo(!fixed(b)), better: flag(!fixed(a), !fixed(b)) },
    { label: "Takes a graphics card", a: yesNo(gpuSlot(a)), b: yesNo(gpuSlot(b)), better: flag(gpuSlot(a), gpuSlot(b)) },
    { label: "Portable", a: portable(a), b: portable(b), better: pick(rank[a.kind], rank[b.kind], "higher") },
  ];
}

function partSections(a: MachineView, b: MachineView): CompareSection[] {
  const out: CompareSection[] = [];
  for (const type of PART_TYPES) {
    const pa = a.evaluated.lines.filter((l) => l.slot === type && l.part);
    const pb = b.evaluated.lines.filter((l) => l.slot === type && l.part);
    if (!pa.length && !pb.length) continue;
    const names = (ls: typeof pa) => (ls.length ? ls.map((l) => `${l.qty > 1 ? `${l.qty} x ` : ""}${partName(l.part!)}`).join(" + ") : "None");
    const rows: CompareRow[] = [{ label: "Part", a: names(pa), b: names(pb) }];
    const keys = [...new Set([...pa, ...pb].flatMap((l) => Object.keys(l.part!.specs)))];
    for (const key of keys) {
      const vals = (ls: typeof pa) => ls.map((l) => (l.part!.specs as Record<string, unknown>)[key]).filter((v) => v !== undefined);
      const [va, vb] = [vals(pa), vals(pb)];
      const text = (v: unknown[]) => (v.length ? v.map(showValue).join(" + ") : "None");
      const dir = BETTER[key];
      const single = (v: unknown[], ls: typeof pa) => (ls.length === 1 && typeof v[0] === "number" ? v[0] : null);
      rows.push({
        label: SPEC_LABELS[key] ?? key,
        a: text(va),
        b: text(vb),
        better: dir ? pick(single(va, pa), single(vb, pb), dir) : undefined,
      });
    }
    out.push({ title: TYPE_LABEL[type].one, rows });
  }
  return out;
}

export function compare(a: MachineView, b: MachineView): CompareView {
  const priceDelta =
    a.price && b.price && a.price.currency === b.price.currency
      ? { amount: a.price.amount - b.price.amount, currency: a.price.currency }
      : null;
  return { a, b, priceDelta, summary: summaryRows(a, b), sections: partSections(a, b) };
}
