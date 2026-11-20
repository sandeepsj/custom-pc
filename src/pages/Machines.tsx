import { useState } from "react";
import { imageUrl, useApi, type MachineView, type PricedPart } from "../api";
import { Checks, HeadroomList, PartsTable } from "../components/Evaluation";
import { PartDetail } from "../components/PartDetail";
import { Sheet } from "../components/Sheet";
import { KIND_LABEL, money, partName, size } from "../specs";
import { saveDraft } from "./Builder";

const facts = (m: MachineView): [string, string][] => {
  const s = m.evaluated.summary;
  const rows: [string, string | null][] = [
    ["Processor", s.cpu && `${s.cpu}, ${s.cores} cores`],
    ["Memory", s.ramGB ? `${s.ramGB} GB ${s.ramType ?? ""}`.trim() : null],
    ["Storage", s.storageGB ? `${size(s.storageGB)} ${s.storageType ?? ""}`.trim() : null],
    ["Graphics", s.gpu],
    ["Wi-Fi", s.wifi],
    ["Screen", s.display],
    ["Battery", s.batteryWh ? `${s.batteryWh} Wh` : null],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
};

const priceText = (m: MachineView) => (m.price ? money(m.price.amount, m.price.currency) : "No price yet");

const priceNote = (m: MachineView) => {
  const e = m.evaluated;
  if (!m.price) return "Add listings to the machine or its parts.";
  if (m.price.source === "listing") return m.price.inStock ? `Sold as a whole machine by ${m.price.seller}` : `Last listed price at ${m.price.seller}, now out of stock`;
  const gaps = e.unpricedCount ? `. ${e.unpricedCount} ${e.unpricedCount === 1 ? "part has" : "parts have"} no price yet` : "";
  return `Sum of its parts at the lowest in-stock price${gaps}`;
};

export function Machines({ id }: { id?: string }) {
  const { data, error } = useApi<MachineView[]>("/api/machines");
  const [detail, setDetail] = useState<PricedPart | null>(null);
  if (error) return <p className="empty">Could not load machines: {error}</p>;
  if (!data) return null;
  const m = id ? data.find((x) => x.id === id) : undefined;

  if (!m)
    return (
      <section className="page">
        <h1>Machines</h1>
        <p className="lede">Each machine is a set of parts from <code>data/parts</code>, joined by a file in <code>data/machines</code>.</p>
        {id && <p className="empty">There is no machine called "{id}".</p>}
        {data.length === 0 && <p className="empty">No machines yet. Add a JSON file to <code>data/machines/</code> and refresh.</p>}
        <ul className="machines">
          {data.map((x) => (
            <li key={x.id}>
              <a className="machine" href={`#/machines/${x.id}`} data-pic={!!x.image}>
                {x.image && <img className="machine-thumb" src={imageUrl(x.image.file)} alt="" loading="lazy" />}
                <span className="machine-kind">
                  {KIND_LABEL[x.kind]}
                  {x.owned && <span className="tag own">Yours</span>}
                  {x.sample && <span className="tag">Sample</span>}
                </span>
                <span className="machine-name">{x.brand ? `${x.brand} ` : ""}{x.name}</span>
                <span className="machine-facts">
                  {facts(x).slice(0, 4).map(([k, v]) => (
                    <span key={k}><span className="muted">{k}</span> {v}</span>
                  ))}
                </span>
                <span className="machine-price num">{priceText(x)}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    );

  const e = m.evaluated;
  const others = data.filter((x) => x.id !== m.id);
  const fails = e.checks.filter((c) => c.status === "fail").length;
  return (
    <section className="page">
      <p className="crumb"><a href="#/machines">All machines</a></p>
      <div className="build-head">
        <div>
          <p className="machine-kind">
            {KIND_LABEL[m.kind]}
            {m.owned && <span className="tag own">Yours</span>}
            {m.sample && <span className="tag">Sample</span>}
          </p>
          <h1>{m.brand ? `${m.brand} ` : ""}{m.name}</h1>
          {m.purpose && <p className="lede">{m.purpose}</p>}
        </div>
        <div className="starts">
          {m.kind === "custom" && <a className="btn" href="#/build" onClick={() => saveDraft(m.parts)}>Open in the builder</a>}
          {others.length > 0 && (
            <label className="sort">
              Compare with
              <select value="" onChange={(ev) => ev.target.value && (window.location.hash = `#/compare/${m.id}/${ev.target.value}`)}>
                <option value="">Choose a machine</option>
                {others.map((o) => <option key={o.id} value={o.id}>{o.brand ? `${o.brand} ` : ""}{o.name}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="build-grid">
        <div>
          {m.image && (
            <figure className="photo">
              <img src={imageUrl(m.image.file)} alt={`${m.brand ? `${m.brand} ` : ""}${m.name}`} />
              {(m.image.credit || m.image.source) && (
                <figcaption className="muted">
                  {m.image.source ? <a href={m.image.source} target="_blank" rel="noreferrer">{m.image.credit ?? "Image source"}</a> : m.image.credit}
                </figcaption>
              )}
            </figure>
          )}
          <dl className="facts">
            {[...facts(m), ...Object.entries(m.extra ?? {}).map(([k, v]) => [k, String(v)] as [string, string])].map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          <h2>Parts</h2>
          <PartsTable lines={e.lines} onOpen={setDetail} />
          {m.price?.source === "listing" && e.total && (
            <p className="muted key">
              The parts that are sold separately add up to {money(e.total.amount, e.total.currency)}
              {e.builtInCount ? `; ${e.builtInCount} built-in ${e.builtInCount === 1 ? "part has" : "parts have"} no price of their own` : ""}.
            </p>
          )}
          {m.listings.length > 0 && (
            <>
              <h2>Where the whole machine is sold</h2>
              <ul className="sellers boxed">
                {[...m.listings].sort((a, b) => a.price - b.price).map((l) => (
                  <li key={l.seller + l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer">{l.seller}</a>
                    <span className="muted">{l.inStock ? "In stock" : "Out of stock"}, checked {l.checkedAt}</span>
                    <strong className="num">{money(l.price, l.currency)}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
          {m.notes && (
            <>
              <h2>Notes</h2>
              <p className="prose">{m.notes}</p>
            </>
          )}
          {e.steps.length > 0 && (
            <>
              <h2>How to put it together</h2>
              <ol className="steps">
                {e.steps.map((s) => (
                  <li key={s.title}><strong>{s.title}</strong><p>{s.detail}</p></li>
                ))}
              </ol>
            </>
          )}
          <p className="muted file">data/machines/{m.id}.json</p>
        </div>

        <aside className="side">
          <div className="total">
            <span className="muted">Price</span>
            <strong className="num">{priceText(m)}</strong>
            <span className="muted">{priceNote(m)}</span>
            {fails > 0 && <span className="verdict fail">{fails} {fails === 1 ? "problem" : "problems"} in the parts list</span>}
          </div>
          <h2>Compatibility</h2>
          <Checks checks={e.checks} empty="Nothing to check yet." />
          <h2>Room to upgrade</h2>
          <HeadroomList items={e.headroom} empty="Add a motherboard to see what can be added later." />
        </aside>
      </div>

      {detail && (
        <Sheet title={partName(detail)} onClose={() => setDetail(null)}>
          <PartDetail part={detail} />
        </Sheet>
      )}
    </section>
  );
}
