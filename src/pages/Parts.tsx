import { useMemo, useState } from "react";
import { PART_TYPES, type PartType } from "../../shared/labels";
import { useApi, type PricedPart } from "../api";
import { PartDetail } from "../components/PartDetail";
import { Sheet } from "../components/Sheet";
import { highlights, money, partName, TYPE_LABEL } from "../specs";

type Sort = "price-asc" | "price-desc" | "name";

export function Parts({ type: raw }: { type?: string }) {
  const type = (PART_TYPES as readonly string[]).includes(raw ?? "") ? (raw as PartType) : "cpu";
  const { data, error } = useApi<PricedPart[]>("/api/parts");
  const [brand, setBrand] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("price-asc");
  const [open, setOpen] = useState<PricedPart | null>(null);

  const ofType = useMemo(() => (data ?? []).filter((p) => p.type === type), [data, type]);
  const brands = useMemo(() => [...new Set(ofType.map((p) => p.brand))].sort(), [ofType]);
  const activeBrand = brand && brands.includes(brand) ? brand : null;
  const rows = useMemo(() => {
    const list = ofType.filter((p) => !activeBrand || p.brand === activeBrand);
    const price = (p: PricedPart) => p.bestPrice?.amount ?? Infinity;
    return list.sort((a, b) =>
      sort === "name" ? partName(a).localeCompare(partName(b)) : sort === "price-asc" ? price(a) - price(b) : price(b) - price(a),
    );
  }, [ofType, activeBrand, sort]);
  const cols = rows[0] ? highlights(rows[0]).map(([label]) => label) : [];

  return (
    <section className="page">
      <h1>Parts</h1>
      <p className="lede">Everything in <code>data/parts</code>. Pick a row to see every spec and every seller.</p>

      <div className="tabs" role="tablist" aria-label="Part type">
        {PART_TYPES.map((t) => (
          <a key={t} role="tab" href={`#/parts/${t}`} aria-selected={t === type} data-type={t}>
            {TYPE_LABEL[t].many}
            <span className="count">{(data ?? []).filter((p) => p.type === t).length}</span>
          </a>
        ))}
      </div>

      <div className="filters">
        <div className="chips">
          <button aria-pressed={!activeBrand} onClick={() => setBrand(null)}>All brands</button>
          {brands.map((b) => (
            <button key={b} aria-pressed={activeBrand === b} onClick={() => setBrand(b)}>{b}</button>
          ))}
        </div>
        <label className="sort">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="price-asc">Lowest price</option>
            <option value="price-desc">Highest price</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      {error && <p className="empty">Could not load parts: {error}</p>}
      {data && rows.length === 0 && (
        <p className="empty">
          No {TYPE_LABEL[type].many.toLowerCase()} yet. Add a JSON file to <code>data/parts/{type}/</code> and refresh.
        </p>
      )}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="parts">
            <thead>
              <tr>
                <th>{TYPE_LABEL[type].one}</th>
                {cols.map((c) => <th key={c}>{c}</th>)}
                <th className="r">Best price</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} onClick={() => setOpen(p)}>
                  <td>
                    <button className="row-link" onClick={(e) => { e.stopPropagation(); setOpen(p); }}>
                      <span className="muted">{p.brand}</span> {p.model}
                    </button>
                    {p.sample && <span className="tag">Sample</span>}
                  </td>
                  {highlights(p).map(([k, v]) => <td key={k}>{v}</td>)}
                  <td className="r">
                    {p.bestPrice ? (
                      <>
                        <strong className="num">{money(p.bestPrice.amount, p.bestPrice.currency)}</strong>
                        <span className="muted sub">{p.bestPrice.seller}{p.listings.length > 1 ? `, ${p.listings.length} sellers` : ""}</span>
                      </>
                    ) : (
                      <span className="muted">{p.replaceable === false ? "Built in" : "No price yet"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Sheet title={partName(open)} onClose={() => setOpen(null)}>
          <PartDetail part={open} />
        </Sheet>
      )}
    </section>
  );
}
