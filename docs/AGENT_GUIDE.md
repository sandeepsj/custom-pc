# Guide for an agent collecting parts

Hand this file to an AI agent along with what you want collected, for example "add current AM5 B650 and B850 motherboards sold in India".

## Rules

1. One part per file at `data/parts/<type>/<id>.json`. `id` is kebab-case `<brand>-<model>` and equals the filename.
2. Follow [`docs/SCHEMA.md`](SCHEMA.md) exactly. Unknown fields are rejected. Put anything without a field in `extra`.
3. Take specs from the maker's product page, not from a seller's listing.
4. Add one `listings` entry per seller you checked. Use the direct product URL, the price actually shown, and today's date in `checkedAt`. Set `inStock` to what the page says.
5. Leave `sample` out for entries you verified. Keep `"sample": true` only on placeholders.
6. Never invent a number. If a spec cannot be found, stop and report it instead of guessing, since the compatibility checks rely on these fields.
7. Run `npm run validate` and fix everything it reports before finishing.

## Adding a machine

1. Make sure every part exists in `data/parts/`. A laptop or mini PC is described with part files too: processor, mainboard (`formFactor` `Laptop` or `Mini PC`), memory, drive, Wi-Fi card, screen, battery.
2. Mark soldered or built-in parts with `"replaceable": false`. They need no listings. Soldered memory is its own ram part with `formFactor` `Soldered`; the board's `ramSlots` counts sockets only.
3. Create `data/machines/<id>.json` naming the parts. Set `kind`. For a machine sold whole, put its price in the machine's `listings`.
4. Run `npm run validate`.

Comparisons are generated between any two machines. To match a laptop with a custom PC, add a custom machine whose processor class, memory and storage match it as closely as desktop parts allow.

## Pictures

Save the picture in `data/images/` with a lowercase filename (png, jpg, webp or svg) and point to it with `"image": { "file": "...", "source": "<where it came from>", "credit": "<whose it is>" }` on the part or machine. Take it from the maker's own site, and always record the source.

## Updating prices

Edit the `price`, `inStock` and `checkedAt` of existing listings. Add new sellers as new entries. Do not delete a listing just because it is out of stock; set `inStock` to `false`.
