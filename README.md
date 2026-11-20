# Custom PC

A data-first workbench for planning a desktop PC that can be upgraded over time.

- **Parts are JSON files** in `data/`. You, or an AI agent, add one file per part with its specs, sellers, prices and links.
- **A small API** reads those files, finds the best price, adds up builds and checks that the parts fit together.
- **Machines** join parts into a whole computer: a custom PC, a laptop or a mini PC. Each is one JSON file listing part ids.
- **A web UI** shows the data: browse parts, lay out a build on a board, open any machine, and compare any two machines.

The UI never searches the internet. Everything it shows comes from the JSON in this repo.

> Entries marked `"sample": true` are **sample data**: specs are approximate and prices are placeholders. Replace them with checked entries before buying anything.

## Quick start

```sh
npm install
npm run dev        # API on :8787, UI on http://localhost:5173
npm run validate   # check every JSON file after adding or editing data
```

Edit a JSON file and refresh the page: the API re-reads `data/` on every request.

## What the UI does

| Page | What you see |
| --- | --- |
| **Build** | A board layout with a slot per part. Pick a slot to choose a part. Shows total price, compatibility checks, room to upgrade, a shopping list with seller links and assembly steps. Your picks are kept in the browser only. |
| **Machines** | Every machine in `data/machines/`. Opening one shows its parts, price, compatibility and room to upgrade. Read-only. |
| **Parts** | Every part by type, with key specs side by side, brand filter and price sort. A row opens the full spec sheet and all sellers. |
| **Compare** | Any two machines side by side: price difference, a summary, then every spec of every part lined up. Generated from the two JSON files on each request; nothing is written by hand. |

## Repo layout

```
data/
  parts/<type>/<id>.json   one file per part; types: cpu motherboard ram gpu storage psu case cooler wifi display battery ups
  images/                  pictures of parts and machines, named in their `image` field
  machines/<id>.json       a custom PC, laptop or mini PC: a named set of part ids, plus its own listings if sold whole
shared/schema.ts           the schema for all of the above (Zod)
shared/evaluate.ts         pricing, compatibility checks, upgrade headroom, assembly steps
shared/compare.ts          generates the comparison of two machines
shared/labels.ts           names for part types and spec fields
server/                    read-only API (Hono)
scripts/validate.ts        schema and cross-reference check
src/                       the UI (React + Vite)
docs/SCHEMA.md             every field explained
docs/AGENT_GUIDE.md        instructions to hand an AI agent that collects parts
```

## Adding data

1. Copy an existing file of the same type in `data/parts/<type>/`.
2. Name it `<brand>-<model>.json` in kebab-case and set `id` to the same name.
3. Fill in `specs` and `listings` (see [docs/SCHEMA.md](docs/SCHEMA.md)).
4. Run `npm run validate`.

Files that fail validation are skipped, and the UI shows a banner listing what is wrong. To let an agent do the collecting, give it [docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md).

### Machines

A machine file names the parts it is made of. For a custom PC the price is the sum of its parts. A laptop or mini PC is described the same way: its processor, mainboard, memory, drive, Wi-Fi card, screen and battery are part files too. Parts that are soldered or built in carry `"replaceable": false` and need no listings. The price of the whole unit goes in the machine's own `listings`.

Once two machines exist, the Compare page can put them side by side. There is nothing else to write.

## Choosing a base that can grow

The build page's "Room to upgrade" panel is computed from these fields, so they are the ones to weigh when picking the base:

- **Motherboard socket.** A current socket (AM5 today) accepts newer CPUs later. A socket at the end of its life (LGA1700) does not.
- **Memory slots.** Four slots with a 2-stick kit leaves two free. Two sticks, not one, for dual channel.
- **M.2 and SATA.** Two or more M.2 slots means storage is added, not replaced.
- **Power supply.** Size it for the graphics card you might add, not only for today's draw.
- **Case.** Check the longest graphics card and tallest cooler it takes, and which board sizes fit.

Existing desk gear (monitor, speakers and a mic on a USB audio interface) carries over unchanged, so it is not part of any build's price.

## Compatibility checks

Socket match, memory type against board and CPU, memory slot count and maximum, M.2 and SATA port count, display output when there is no graphics card, board size against case, graphics card length, cooler mount, height and rating, power supply size (estimated draw plus 30%) and form factor, and UPS output against the PC plus a monitor. They are rule checks over the JSON fields: a guide, not a guarantee. Confirm against the makers' support lists before buying.

## API

All read-only except `POST /api/evaluate`, which only computes.

| Route | Returns |
| --- | --- |
| `GET /api/health` | counts and a list of data files that failed validation |
| `GET /api/parts?type=cpu` | parts, each with `bestPrice` (lowest in-stock listing) |
| `GET /api/parts/:id` | one part |
| `GET /api/machines`, `/api/machines/:id` | machines with resolved parts, price, checks, headroom, steps |
| `GET /api/compare?a=<id>&b=<id>` | two machines, the price difference, summary rows and per-part spec rows |
| `POST /api/evaluate` | the same evaluation for any selection of part ids |

`npm run build` then `npm start` serves the built UI and the API together on port 8787.

## Published site

Every push to `main` publishes the site to GitHub Pages (`.github/workflows/pages.yml`). Pages has no server, so `npm run build:pages` writes all the data into one `data.json` and the browser runs the same pricing, checking and comparison code from `shared/` that the API runs locally. The published site shows whatever is in `data/` at that commit.
