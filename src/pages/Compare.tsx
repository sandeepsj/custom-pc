import { imageUrl, useApi, type CompareRow, type CompareView, type MachineView } from "../api";
import { KIND_LABEL, money } from "../specs";

const label = (m: { brand?: string; name: string }) => `${m.brand ? `${m.brand} ` : ""}${m.name}`;

function Rows({ rows }: { rows: CompareRow[] }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.label} data-same={r.a === r.b}>
          <th scope="row">{r.label}</th>
          <td data-better={r.better === "a"}>{r.a}</td>
          <td data-better={r.better === "b"}>{r.b}</td>
        </tr>
      ))}
    </>
  );
}

function Result({ a, b }: { a: string; b: string }) {
  const { data, error } = useApi<CompareView>(`/api/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
  if (error) return <p className="empty">Could not compare these machines: {error}</p>;
  if (!data) return null;
  const d = data.priceDelta;
  const [na, nb] = [label(data.a), label(data.b)];
  const headline = !d
    ? `${na} and ${nb}`
    : d.amount === 0
      ? `${na} and ${nb} cost the same`
      : `${na} costs ${money(Math.abs(d.amount), d.currency)} ${d.amount < 0 ? "less" : "more"} than ${nb}`;
  const head = (m: MachineView) => (
    <th>
      {m.image && <img className="vs-photo" src={imageUrl(m.image.file)} alt="" />}
      <span className="muted">{KIND_LABEL[m.kind]}{m.owned ? ", yours" : ""}</span>
      <span className="vs-name">{label(m)}</span>
      <span className="vs-price num">{m.price ? money(m.price.amount, m.price.currency) : "No price"}</span>
      <a href={`#/machines/${m.id}`}>See this machine</a>
    </th>
  );
  return (
    <>
      <h1 className="verdict-line">{headline}</h1>
      {!d && <p className="lede">One of these has no price yet, so only the specs are compared.</p>}
      {[data.a, data.b].filter((m) => m.price?.inStock === false).map((m) => (
        <p className="lede" key={m.id}>{label(m)} is out of stock, so its price is the last one a seller listed.</p>
      ))}
      <div className="table-wrap">
        <table className="versus">
          <thead>
            <tr><td />{head(data.a)}{head(data.b)}</tr>
          </thead>
          <tbody>
            <Rows rows={data.summary.filter((r) => r.label !== "Kind" && r.label !== "Price")} />
          </tbody>
          {data.sections.map((s) => (
            <tbody key={s.title}>
              <tr className="section"><th colSpan={3} scope="rowgroup">{s.title}</th></tr>
              <Rows rows={s.rows} />
            </tbody>
          ))}
        </table>
      </div>
      <p className="muted key"><span className="better-key" aria-hidden="true" /> marks the stronger side where a number decides it. Generated from the two machines' JSON.</p>
    </>
  );
}

export function Compare({ a, b }: { a?: string; b?: string }) {
  const { data, error } = useApi<MachineView[]>("/api/machines");
  if (error) return <p className="empty">Could not load machines: {error}</p>;
  if (!data) return null;
  if (data.length < 2)
    return (
      <section className="page">
        <h1>Compare</h1>
        <p className="empty">Comparing needs two machines. Add another JSON file to <code>data/machines/</code>.</p>
      </section>
    );
  const first = data.find((m) => m.id === a) ?? data.find((m) => m.owned) ?? data[0]!;
  const second = data.find((m) => m.id === b && m.id !== first.id) ?? data.find((m) => m.id !== first.id)!;
  const go = (x: string, y: string) => (window.location.hash = `#/compare/${x}/${y}`);
  const picker = (value: string, other: string, onChange: (id: string) => void, name: string) => (
    <label className="sort">
      {name}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {data.map((m) => <option key={m.id} value={m.id} disabled={m.id === other}>{label(m)}</option>)}
      </select>
    </label>
  );
  return (
    <section className="page">
      <div className="pickers">
        {picker(first.id, second.id, (id) => go(id, second.id), "Compare")}
        {picker(second.id, first.id, (id) => go(first.id, id), "with")}
        <button className="ghost" onClick={() => go(second.id, first.id)}>Swap sides</button>
      </div>
      <Result a={first.id} b={second.id} />
    </section>
  );
}
