import { imageUrl, type PricedPart } from "../api";
import { allSpecs, money } from "../specs";

/** Full spec sheet and every seller for one part. */
export function PartDetail({ part }: { part: PricedPart }) {
  const sellers = [...part.listings].sort((a, b) => a.price - b.price);
  return (
    <div className="detail">
      {part.image && (
        <figure className="photo">
          <img src={imageUrl(part.image.file)} alt={`${part.brand} ${part.model}`} />
          {part.image.credit && <figcaption className="muted">{part.image.credit}</figcaption>}
        </figure>
      )}
      {part.sample && <p className="note">Sample entry. Specs and prices are placeholders until someone checks them.</p>}
      {part.notes && <p>{part.notes}</p>}

      <h3>Where to buy</h3>
      {sellers.length === 0 ? (
        <p className="muted">
          {part.replaceable === false
            ? "Built into the machine, so it is not sold on its own."
            : "No sellers listed yet. Add a listing to this part's JSON file."}
        </p>
      ) : (
        <ul className="sellers">
          {sellers.map((l) => (
            <li key={l.seller + l.url}>
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.seller}
              </a>
              <span className="muted">
                {l.inStock ? "In stock" : "Out of stock"}, checked {l.checkedAt}
              </span>
              <strong className="num">{money(l.price, l.currency)}</strong>
            </li>
          ))}
        </ul>
      )}

      <h3>Specs</h3>
      <dl className="specs">
        {allSpecs(part).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="muted file">data/parts/{part.type}/{part.id}.json</p>
    </div>
  );
}
