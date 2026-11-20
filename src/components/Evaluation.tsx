/** Read-only panels for an evaluated set of parts. Shared by the builder and the machine page. */
import type { Evaluated, PricedPart } from "../api";
import { money, partName, TYPE_LABEL } from "../specs";

const ORDER = { fail: 0, warn: 1, info: 2, ok: 3 } as const;
const WORD = { fail: "Problem", warn: "Check", info: "Note", ok: "Fits" } as const;

export function Checks({ checks, empty }: { checks: Evaluated["checks"]; empty: string }) {
  if (!checks.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="checks">
      {[...checks].sort((a, b) => ORDER[a.status] - ORDER[b.status]).map((c) => (
        <li key={c.id} className={c.status}>
          <span className="mark" aria-hidden="true" />
          <div>
            <strong>{c.label}</strong> <span className="status-word">{WORD[c.status]}</span>
            <p>{c.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HeadroomList({ items, empty }: { items: Evaluated["headroom"]; empty: string }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="headroom">
      {items.map((h) => (
        <li key={h.label} className={h.tone}>
          <span className="muted">{h.label}</span>
          <strong>{h.value}</strong>
          <p>{h.detail}</p>
        </li>
      ))}
    </ul>
  );
}

export function PartsTable({ lines, onOpen }: { lines: Evaluated["lines"]; onOpen: (p: PricedPart) => void }) {
  return (
    <div className="table-wrap">
      <table className="parts">
        <tbody>
          {lines.filter((l) => l.part).map((l) => {
            const p = l.part!;
            const builtIn = p.replaceable === false;
            return (
              <tr key={l.slot + p.id} onClick={() => onOpen(p)}>
                <td className="muted">{TYPE_LABEL[l.slot].one}</td>
                <td>
                  <button className="row-link" onClick={(e) => { e.stopPropagation(); onOpen(p); }}>
                    {l.qty > 1 ? `${l.qty} x ` : ""}{partName(p)}
                  </button>
                </td>
                <td>
                  {p.bestPrice ? (
                    <a href={p.bestPrice.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{p.bestPrice.seller}</a>
                  ) : (
                    <span className="muted">{builtIn ? "Built in" : "No seller"}</span>
                  )}
                </td>
                <td className="r num">
                  {l.lineTotal !== null ? money(l.lineTotal, p.bestPrice!.currency) : <span className="muted">{builtIn ? "Not sold separately" : "No price"}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
