# Data schema

The authoritative definition is [`shared/schema.ts`](../shared/schema.ts). This page explains it. Unknown fields are rejected, so typos get caught by `npm run validate`.

## Every part

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | kebab-case, identical to the filename without `.json` |
| `type` | yes | must match the folder: `cpu`, `motherboard`, `ram`, `gpu`, `storage`, `psu`, `case`, `cooler`, `wifi`, `display`, `battery`, `ups` |
| `brand`, `model` | yes | shown as "brand model" |
| `series`, `releaseYear` | no | |
| `specs` | yes | depends on `type`, see below |
| `listings` | no | who sells it, see below |
| `notes` | no | free text shown on the detail panel |
| `image` | no | `{ "file": "name.png", "source": "https://...", "credit": "..." }`. The file lives in `data/images/`; machines take the same field |
| `extra` | no | `{ "label": value }` pairs for specs the schema has no field for |
| `replaceable` | no | `false` for a soldered or built-in component (laptop CPU, soldered memory). It needs no listings and counts as fixed in "Room to upgrade" |
| `sample` | no | `true` while the entry is unverified placeholder data |
| `updatedAt` | no | `YYYY-MM-DD` |

### Listing

```json
{ "seller": "MD Computers", "url": "https://...", "price": 17500, "currency": "INR", "inStock": true, "checkedAt": "2026-11-20" }
```

`currency` is a 3-letter code and defaults to `INR`. The best price is the lowest in-stock listing, or the lowest of all if none is in stock.

## Specs by type

Fields marked ★ feed the compatibility checks.

**cpu**: ★`socket`, `cores`, `threads`, `baseGHz`, `boostGHz`, ★`tdpW`, ★`memoryTypes` (`["DDR5"]`), ★`integratedGraphics` (name or `null`), `pcieGen`, ★`coolerIncluded`

**motherboard**: ★`socket`, `chipset`, ★`formFactor` (`ATX` `mATX` `ITX` `E-ATX` `Laptop` `Mini PC`), ★`memoryType` (`DDR4` `DDR5`), ★`ramFormFactor` (`DIMM` `SO-DIMM`, default `DIMM`), ★`ramSlots` (sockets only, not soldered memory), ★`maxRamGB`, ★`m2Slots`, ★`sataPorts`, `pcieX16Slots`, `pcieGen`, `wifi` (name or `null`), `bluetooth` (version or `null`), `ethernet`, `videoOutputs[]`, `usbRear[]`, `audio`?

**ram** (one file per kit): ★`memoryType`, ★`formFactor` (`DIMM` `SO-DIMM` `Soldered`, default `DIMM`; soldered memory uses no slot), ★`modules` (sticks in the kit), ★`moduleGB` (per stick), `speedMTs`, `casLatency`?

**gpu**: `chipset`, `vramGB`, ★`lengthMm`, ★`tdpW`, ★`recommendedPsuW`, `outputs[]`, `powerConnectors`

**storage**: `kind` (`ssd` `hdd`), ★`interface` (`nvme` `sata`), `formFactor` (`M.2 2280` `M.2 2242` `M.2 2230` `2.5in` `3.5in`), `capacityGB`, `readMBs`?, `writeMBs`?, `pcieGen`?

**psu**: ★`wattage`, `efficiency`, `modular` (`full` `semi` `no`), ★`formFactor` (`ATX` `SFX` `SFX-L`)

**case**: `style`, ★`supportedMotherboards[]`, ★`maxGpuLengthMm`, ★`maxCoolerHeightMm`, ★`psuFormFactors[]`, `includedFans`, `driveBays`?

**cooler**: `kind` (`air` `aio`), ★`sockets[]`, ★`heightMm`, ★`tdpRatingW`, `radiatorMm`?

**wifi**: `standard`, `bluetooth` (version or `null`), `interface` (`PCIe` `M.2` `USB`)

**display**: `sizeIn`, `widthPx`, `heightPx`, `refreshHz`, `panel`, `brightnessNits`?, `touch`?

**battery**: `capacityWh`, `chemistry`?

**ups**: `capacityVA`, ★`outputW` (real watts, usually about 60% of the VA rating), `topology` (`offline` `line-interactive` `online`), `waveform` (`simulated sine` `pure sine`), `outlets` (battery-backed), `usbLink`

## Machine (`data/machines/`)

```json
{
  "id": "desk-baseline",
  "kind": "custom",
  "name": "Desk baseline",
  "brand": "optional, for ready-made machines",
  "purpose": "One line on what it is for",
  "owned": false,
  "parts": {
    "cpu": "amd-ryzen-5-7600",
    "motherboard": "msi-b650m-gaming-plus-wifi",
    "ram": [{ "id": "corsair-vengeance-ddr5-32gb-6000", "qty": 1 }],
    "storage": [{ "id": "wd-black-sn770-1tb", "qty": 1 }],
    "gpu": "optional part id",
    "psu": "corsair-cx550",
    "case": "cooler-master-q300l",
    "cooler": "optional part id",
    "wifi": "optional part id",
    "display": "optional part id",
    "battery": "optional part id",
    "ups": "optional part id"
  },
  "listings": [],
  "notes": "optional"
}
```

- `kind` is `custom`, `laptop` or `minipc`.
- Every slot is optional. `qty` for memory counts kits, not sticks. Every id must exist in the matching `data/parts/` folder.
- `listings` is the price of the whole machine, for laptops and mini PCs. When it is empty the price is the sum of the parts.
- `owned: true` marks a machine you already have.

## Comparison

There is no comparison file. `GET /api/compare?a=<id>&b=<id>` builds one from the two machines: a summary (price, cores, memory, storage, free slots, what can be swapped), then one section per part type with every spec field side by side. Numeric fields with an obvious direction mark the stronger side; the list of those fields is `BETTER` in [`shared/labels.ts`](../shared/labels.ts).
