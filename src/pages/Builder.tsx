import { useEffect, useMemo, useState } from "react";
import type { PartType } from "../../shared/labels";
import { evaluateSelection, useApi, type MachineView, type Evaluated, type PricedPart, type Selection } from "../api";
import { Checks, HeadroomList, PartsTable } from "../components/Evaluation";
import { PartDetail } from "../components/PartDetail";
import { Sheet } from "../components/Sheet";
import { highlights, money, partName, size, TYPE_LABEL } from "../specs";

const EMPTY: Selection = { ram: [], storage: [] };
const DRAFT_KEY = "draft-build";
const MULTI = new Set<PartType>(["ram", "storage"]);

export function loadDraft(): Selection | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Selection) } : null;
  } catch {
    return null;
  }
}
export const saveDraft = (sel: Selection) => localStorage.setItem(DRAFT_KEY, JSON.stringify(sel));

const same = (a: Selection, b: Selection) => {
  const norm = (s: Selection) => JSON.stringify(Object.entries(s).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length)).sort());
  return norm(a) === norm(b);
};

export function Builder() {
  const parts = useApi<PricedPart[]>("/api/parts");
  const machines = useApi<MachineView[]>("/api/machines");
  const builds = { data: machines.data?.filter((m) => m.kind === "custom") };
  const [sel, setSel] = useState<Selection | null>(loadDraft);
  const [ev, setEv] = useState<Evaluated | null>(null);
  const [evError, setEvError] = useState<string | null>(null);
  const [picking, setPicking] = useState<PartType | null>(null);
  const [detail, setDetail] = useState<PricedPart | null>(null);

  // First visit: start from the first saved build so the page is never blank.
  useEffect(() => {
    if (!sel && builds.data) setSel(builds.data[0]?.parts ?? EMPTY);
  }, [sel, machines.data]);

  useEffect(() => {
    if (!sel) return;
    saveDraft(sel);
    let live = true;
    evaluateSelection(sel).then(
      (r) => live && (setEv(r), setEvError(null)),
      (e: Error) => live && setEvError(e.message),
    );
    return () => {
      live = false;
    };
  }, [sel]);

  const loaded = useMemo(() => (sel ? builds.data?.find((b) => same(b.parts, sel)) : undefined), [machines.data, sel]);
  const line = (t: PartType) => ev?.lines.filter((l) => l.slot === t && l.part) ?? [];
  const one = (t: PartType) => line(t)[0]?.part ?? null;

  const setQty = (t: "ram" | "storage", id: string, qty: number) =>
    setSel((s) => {
      const cur = s ?? EMPTY;
      const rest = cur[t].filter((x) => x.id !== id);
      const had = cur[t].some((x) => x.id === id);
      const next = qty <= 0 ? rest : had ? cur[t].map((x) => (x.id === id ? { id, qty } : x)) : [...rest, { id, qty }];
      return { ...cur, [t]: next };
    });
  const setOne = (t: PartType, id: string | undefined) => {
    setSel((s) => ({ ...(s ?? EMPTY), [t]: id }));
    setPicking(null);
  };

  const sticks = line("ram").reduce((n, l) => n + (l.part!.type === "ram" ? l.part!.specs.modules * l.qty : 0), 0);
  const ramTotal = ev?.usage.ramSlots?.total ?? 4;
  const nvme = line("storage").flatMap((l) => (l.part!.type === "storage" && l.part!.specs.interface === "nvme" ? Array(l.qty).fill(l.part!) : []) as PricedPart[]);
  const sata = line("storage").flatMap((l) => (l.part!.type === "storage" && l.part!.specs.interface === "sata" ? Array(l.qty).fill(l.part!) : []) as PricedPart[]);
  const m2Total = Math.max(ev?.usage.m2?.total ?? 2, nvme.length);
  const checks = ev?.checks ?? [];
  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const priced = ev?.lines.filter((l) => l.part) ?? [];

  const slot = (t: PartType, cls = "") => {
    const p = one(t);
    return (
      <button className={`slot ${cls}`} data-slot={t} data-filled={!!p} onClick={() => setPicking(t)}>
        <span className="slot-kind">{TYPE_LABEL[t].one}</span>
        <span className="slot-name">{p ? partName(p) : t === "cooler" && one("cpu") ? "Using the boxed cooler" : t === "wifi" && ev?.summary.wifi ? `${ev.summary.wifi} is built into the board` : `Add ${t === "wifi" ? "a Wi-Fi card" : t === "gpu" ? "a graphics card" : t === "ups" ? "a UPS for power cuts" : `a ${TYPE_LABEL[t].one.toLowerCase()}`}`}</span>
        {p?.bestPrice && <span className="slot-price num">{money(p.bestPrice.amount, p.bestPrice.currency)}</span>}
      </button>
    );
  };

  return (
    <section className="page">
      <div className="build-head">
        <div>
          <h1>{loaded?.name ?? "Your build"}</h1>
          <p className="lede">{loaded?.purpose ?? "Pick a slot on the board to choose or change a part. Prices and checks update as you go."}</p>
        </div>
        <div className="starts">
          <span className="muted">Start from</span>
          {builds.data?.map((b) => (
            <button key={b.id} aria-pressed={loaded?.id === b.id} onClick={() => setSel(b.parts)}>{b.name}</button>
          ))}
          <button aria-pressed={!!sel && same(sel, EMPTY)} onClick={() => setSel(EMPTY)}>Empty board</button>
        </div>
      </div>

      {(parts.error || evError) && <p className="empty">Could not reach the data server: {parts.error ?? evError}</p>}

      <div className="build-grid">
        <div className="rig" aria-label="Build layout">
          {slot("case", "rig-case")}
          <div className="board">
            {slot("motherboard", "board-name")}
            <div className="board-grid">
              {slot("cpu", "a-cpu")}
              <button className="slot a-ram" data-slot="ram" data-filled={sticks > 0} onClick={() => setPicking("ram")}>
                <span className="slot-kind">Memory</span>
                <span className="sticks" aria-hidden="true">
                  {Array.from({ length: Math.max(ramTotal, sticks) }, (_, i) => (
                    <i key={i} data-on={i < sticks} data-over={i >= ramTotal} />
                  ))}
                </span>
                <span className="slot-name">
                  {sticks ? `${ev!.summary.ramGB} GB ${ev!.summary.ramType}, ${sticks} of ${ramTotal} slots` : "Add memory"}
                </span>
              </button>
              {slot("cooler", "a-cooler")}
              <button className="slot a-m2" data-slot="storage" data-filled={nvme.length > 0} onClick={() => setPicking("storage")}>
                <span className="slot-kind">M.2 drives</span>
                <span className="strips">
                  {Array.from({ length: m2Total }, (_, i) => (
                    <i key={i} data-on={!!nvme[i]}>{nvme[i] ? `${nvme[i]!.model}` : "Free slot"}</i>
                  ))}
                </span>
              </button>
              {slot("wifi", "a-wifi")}
              {slot("gpu", "a-gpu")}
            </div>
          </div>
          <div className="bay">
            {slot("psu")}
            <button className="slot" data-slot="storage" data-filled={sata.length > 0} onClick={() => setPicking("storage")}>
              <span className="slot-kind">Drive bays</span>
              <span className="slot-name">{sata.length ? sata.map((p) => p.model).join(", ") : "Add a SATA drive"}</span>
            </button>
          </div>
        </div>

        <div className="outside">{slot("ups")}</div>

        <aside className="side">
          <div className="total">
            <span className="muted">Total</span>
            <strong className="num">{ev?.total ? money(ev.total.amount, ev.total.currency) : "Nothing chosen"}</strong>
            <span className="muted">
              {priced.length} {priced.length === 1 ? "part" : "parts"}, lowest in-stock price for each
              {ev?.unpricedCount ? `. ${ev.unpricedCount} without a price` : ""}
            </span>
            {ev && checks.length > 0 && (
              <span className={`verdict ${fails ? "fail" : warns ? "warn" : "ok"}`}>
                {fails ? `${fails} ${fails === 1 ? "problem" : "problems"} to fix` : warns ? `Works, ${warns} to double-check` : "Everything fits together"}
              </span>
            )}
          </div>

          <h2>Compatibility</h2>
          <Checks checks={checks} empty="Choose a processor and a motherboard to start the checks." />

          <h2>Room to upgrade</h2>
          <HeadroomList items={ev?.headroom ?? []} empty="Choose a motherboard to see what you can add later." />
        </aside>
      </div>

      {priced.length > 0 && (
        <div className="lower">
          <div>
            <h2>Shopping list</h2>
            <PartsTable lines={priced} onOpen={setDetail} />
          </div>
          {ev && ev.steps.length > 0 && (
            <div>
              <h2>How to put it together</h2>
              <ol className="steps">
                {ev.steps.map((s) => (
                  <li key={s.title}>
                    <strong>{s.title}</strong>
                    <p>{s.detail}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {picking && (
        <Sheet title={`Choose ${TYPE_LABEL[picking].one.toLowerCase()}`} onClose={() => setPicking(null)}>
          <ul className="picker">
            {(parts.data ?? [])
              .filter((p) => p.type === picking)
              .sort((a, b) => (a.bestPrice?.amount ?? Infinity) - (b.bestPrice?.amount ?? Infinity))
              .map((p) => {
                const multi = MULTI.has(picking);
                const qty = multi ? sel?.[picking as "ram" | "storage"].find((x) => x.id === p.id)?.qty ?? 0 : 0;
                const chosen = multi ? qty > 0 : sel?.[picking] === p.id;
                return (
                  <li key={p.id} data-chosen={chosen}>
                    <div>
                      <strong>{partName(p)}</strong>
                      <p className="muted">{highlights(p).map(([k, v]) => (p.type === "storage" && k === "Capacity" ? size(p.specs.capacityGB) : v)).join(", ")}</p>
                    </div>
                    <span className="num">{p.bestPrice ? money(p.bestPrice.amount, p.bestPrice.currency) : "No price"}</span>
                    {multi ? (
                      <span className="stepper">
                        <button aria-label={`One fewer ${p.model}`} disabled={qty === 0} onClick={() => setQty(picking as "ram" | "storage", p.id, qty - 1)}>−</button>
                        <span className="num">{qty}</span>
                        <button aria-label={`One more ${p.model}`} onClick={() => setQty(picking as "ram" | "storage", p.id, qty + 1)}>+</button>
                      </span>
                    ) : chosen ? (
                      <button onClick={() => setOne(picking, undefined)}>Remove</button>
                    ) : (
                      <button className="primary" onClick={() => setOne(picking, p.id)}>Choose</button>
                    )}
                  </li>
                );
              })}
          </ul>
          {parts.data && !parts.data.some((p) => p.type === picking) && (
            <p className="empty">Nothing here yet. Add a JSON file to <code>data/parts/{picking}/</code>.</p>
          )}
        </Sheet>
      )}
      {detail && (
        <Sheet title={partName(detail)} onClose={() => setDetail(null)}>
          <PartDetail part={detail} />
        </Sheet>
      )}
    </section>
  );
}
