/**
 * Single source of truth for every JSON file under data/.
 * Used by the API server, the validate script and (types only) the frontend.
 * docs/SCHEMA.md describes the same thing in prose: keep them in sync.
 */
import { z } from "zod";

import { PART_TYPES, type PartType } from "./labels";
export { PART_TYPES, type PartType };

const id = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "id must be kebab-case and match the filename");

/** One seller's offer for a part or system. */
export const Listing = z.strictObject({
  seller: z.string().min(1),
  url: z.url(),
  price: z.number().positive(),
  currency: z.string().length(3).default("INR"),
  inStock: z.boolean().default(true),
  /** ISO date (YYYY-MM-DD) the price was last checked. */
  checkedAt: z.iso.date(),
});
export type Listing = z.infer<typeof Listing>;

/** A picture stored in data/images/. `file` is the filename there; `source` is where it came from. */
export const Image = z.strictObject({
  file: z.string().regex(/^[a-z0-9][a-z0-9._-]*\.(png|jpg|jpeg|webp|svg)$/, "image file must be a plain lowercase filename in data/images/"),
  source: z.url().optional(),
  credit: z.string().optional(),
});

const common = {
  id,
  brand: z.string().min(1),
  model: z.string().min(1),
  series: z.string().optional(),
  releaseYear: z.number().int().optional(),
  listings: z.array(Listing).default([]),
  notes: z.string().optional(),
  image: Image.optional(),
  /** Any additional specs worth showing that the schema has no field for. */
  extra: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  /** false = soldered or built in: cannot be bought or swapped on its own. */
  replaceable: z.boolean().optional(),
  /** true = placeholder data, not verified against a real listing. */
  sample: z.boolean().optional(),
  updatedAt: z.iso.date().optional(),
};

const part = <T extends PartType, S extends z.ZodType>(type: T, specs: S) =>
  z.strictObject({ ...common, type: z.literal(type), specs });

const MemoryType = z.enum(["DDR3", "DDR4", "DDR5"]);
const BoardSize = z.enum(["ATX", "mATX", "ITX", "E-ATX", "Laptop", "Mini PC"]);
const PsuSize = z.enum(["ATX", "SFX", "SFX-L"]);

export const Cpu = part(
  "cpu",
  z.strictObject({
    socket: z.string(),
    cores: z.number().int(),
    threads: z.number().int(),
    baseGHz: z.number(),
    boostGHz: z.number(),
    tdpW: z.number(),
    memoryTypes: z.array(MemoryType).min(1),
    /** Name of the integrated GPU, or null if the CPU has none. */
    integratedGraphics: z.string().nullable(),
    pcieGen: z.number(),
    coolerIncluded: z.boolean(),
  }),
);

export const Motherboard = part(
  "motherboard",
  z.strictObject({
    socket: z.string(),
    chipset: z.string(),
    formFactor: BoardSize,
    memoryType: MemoryType,
    /** Kind of stick the slots take. Soldered memory is a separate ram part and uses no slot. */
    ramFormFactor: z.enum(["DIMM", "SO-DIMM"]).default("DIMM"),
    ramSlots: z.number().int(),
    maxRamGB: z.number(),
    m2Slots: z.number().int(),
    sataPorts: z.number().int(),
    pcieX16Slots: z.number().int(),
    pcieGen: z.number(),
    wifi: z.string().nullable(),
    bluetooth: z.string().nullable(),
    ethernet: z.string(),
    videoOutputs: z.array(z.string()),
    usbRear: z.array(z.string()),
    audio: z.string().optional(),
  }),
);

export const Ram = part(
  "ram",
  z.strictObject({
    memoryType: MemoryType,
    formFactor: z.enum(["DIMM", "SO-DIMM", "Soldered"]).default("DIMM"),
    /** Sticks in the kit, e.g. 2 for a 2x16 GB kit. */
    modules: z.number().int().positive(),
    moduleGB: z.number().positive(),
    speedMTs: z.number(),
    casLatency: z.number().optional(),
  }),
);

export const Gpu = part(
  "gpu",
  z.strictObject({
    chipset: z.string(),
    vramGB: z.number(),
    lengthMm: z.number(),
    tdpW: z.number(),
    recommendedPsuW: z.number(),
    outputs: z.array(z.string()),
    powerConnectors: z.string(),
  }),
);

export const Storage = part(
  "storage",
  z.strictObject({
    kind: z.enum(["ssd", "hdd"]),
    interface: z.enum(["nvme", "sata"]),
    formFactor: z.enum(["M.2 2280", "M.2 2242", "M.2 2230", "2.5in", "3.5in"]),
    capacityGB: z.number(),
    readMBs: z.number().optional(),
    writeMBs: z.number().optional(),
    pcieGen: z.number().optional(),
  }),
);

export const Psu = part(
  "psu",
  z.strictObject({
    wattage: z.number(),
    efficiency: z.string(),
    modular: z.enum(["full", "semi", "no"]),
    formFactor: PsuSize,
  }),
);

export const Case = part(
  "case",
  z.strictObject({
    style: z.string(),
    supportedMotherboards: z.array(BoardSize).min(1),
    maxGpuLengthMm: z.number(),
    maxCoolerHeightMm: z.number(),
    psuFormFactors: z.array(PsuSize).min(1),
    includedFans: z.number().int(),
    driveBays: z.string().optional(),
  }),
);

export const Cooler = part(
  "cooler",
  z.strictObject({
    kind: z.enum(["air", "aio"]),
    sockets: z.array(z.string()).min(1),
    /** Tower height for air coolers. Ignored for AIOs. */
    heightMm: z.number(),
    tdpRatingW: z.number(),
    radiatorMm: z.number().optional(),
  }),
);

export const Wifi = part(
  "wifi",
  z.strictObject({
    standard: z.string(),
    bluetooth: z.string().nullable(),
    interface: z.enum(["PCIe", "M.2", "USB"]),
  }),
);

export const Display = part(
  "display",
  z.strictObject({
    sizeIn: z.number(),
    widthPx: z.number().int(),
    heightPx: z.number().int(),
    refreshHz: z.number(),
    panel: z.string(),
    brightnessNits: z.number().optional(),
    touch: z.boolean().optional(),
  }),
);

export const Battery = part(
  "battery",
  z.strictObject({
    capacityWh: z.number(),
    chemistry: z.string().optional(),
  }),
);

export const Ups = part(
  "ups",
  z.strictObject({
    capacityVA: z.number(),
    /** Real power it can deliver, usually about 60% of the VA rating. */
    outputW: z.number(),
    topology: z.enum(["offline", "line-interactive", "online"]),
    waveform: z.enum(["simulated sine", "pure sine"]),
    outlets: z.number().int(),
    usbLink: z.boolean(),
  }),
);

export const Part = z.discriminatedUnion("type", [
  Cpu,
  Motherboard,
  Ram,
  Gpu,
  Storage,
  Psu,
  Case,
  Cooler,
  Wifi,
  Display,
  Battery,
  Ups,
]);
export type Part = z.infer<typeof Part>;
export type PartOf<T extends PartType> = Extract<Part, { type: T }>;

const Qty = z.strictObject({ id, qty: z.number().int().positive().default(1) });

/** Which part goes in which slot. Every slot is optional so half-finished builds are valid. */
export const Selection = z.strictObject({
  cpu: id.optional(),
  motherboard: id.optional(),
  ram: z.array(Qty).default([]),
  storage: z.array(Qty).default([]),
  gpu: id.optional(),
  psu: id.optional(),
  case: id.optional(),
  cooler: id.optional(),
  wifi: id.optional(),
  display: id.optional(),
  battery: id.optional(),
  ups: id.optional(),
});
export type Selection = z.infer<typeof Selection>;

/**
 * A complete computer: a custom PC, a laptop or a mini PC. Always a collection of parts.
 * Ready-made machines also carry their own listings, which is the price of the whole unit.
 */
export const Machine = z.strictObject({
  id,
  kind: z.enum(["custom", "laptop", "minipc"]),
  name: z.string().min(1),
  brand: z.string().optional(),
  purpose: z.string().optional(),
  /** true = a machine you already own. */
  owned: z.boolean().optional(),
  parts: Selection,
  listings: z.array(Listing).default([]),
  notes: z.string().optional(),
  image: Image.optional(),
  extra: common.extra,
  sample: z.boolean().optional(),
  updatedAt: z.iso.date().optional(),
});
export type Machine = z.infer<typeof Machine>;
