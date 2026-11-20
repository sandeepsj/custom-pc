/** Names for part types and spec fields. No dependencies, so the server and the UI can both import it. */
export const PART_TYPES = [
  "cpu",
  "motherboard",
  "ram",
  "gpu",
  "storage",
  "psu",
  "case",
  "cooler",
  "wifi",
  "display",
  "battery",
  "ups",
] as const;
export type PartType = (typeof PART_TYPES)[number];

export const TYPE_LABEL: Record<PartType, { one: string; many: string }> = {
  cpu: { one: "Processor", many: "Processors" },
  motherboard: { one: "Motherboard", many: "Motherboards" },
  ram: { one: "Memory", many: "Memory" },
  gpu: { one: "Graphics card", many: "Graphics cards" },
  storage: { one: "Storage", many: "Storage" },
  psu: { one: "Power supply", many: "Power supplies" },
  case: { one: "Case", many: "Cases" },
  cooler: { one: "CPU cooler", many: "CPU coolers" },
  wifi: { one: "Wi-Fi card", many: "Wi-Fi cards" },
  display: { one: "Screen", many: "Screens" },
  battery: { one: "Battery", many: "Batteries" },
  ups: { one: "UPS", many: "UPS units" },
};

export const KIND_LABEL = { custom: "Custom PC", laptop: "Laptop", minipc: "Mini PC" } as const;

export const SPEC_LABELS: Record<string, string> = {
  socket: "Socket", cores: "Cores", threads: "Threads", baseGHz: "Base clock (GHz)", boostGHz: "Boost clock (GHz)",
  tdpW: "Power draw (W)", memoryTypes: "Memory supported", integratedGraphics: "Integrated graphics", pcieGen: "PCIe generation",
  coolerIncluded: "Cooler included", chipset: "Chipset", formFactor: "Form factor", memoryType: "Memory type",
  ramFormFactor: "Memory slot type", ramSlots: "Memory slots", maxRamGB: "Maximum memory (GB)", m2Slots: "M.2 slots", sataPorts: "SATA ports",
  pcieX16Slots: "Full-length PCIe slots", wifi: "Wi-Fi", bluetooth: "Bluetooth", ethernet: "Ethernet",
  videoOutputs: "Video outputs", usbRear: "USB ports", audio: "Audio chip", modules: "Sticks in kit",
  moduleGB: "Size per stick (GB)", speedMTs: "Speed (MT/s)", casLatency: "CAS latency", vramGB: "Video memory (GB)",
  lengthMm: "Length (mm)", recommendedPsuW: "Recommended supply (W)", outputs: "Outputs", powerConnectors: "Power connectors",
  kind: "Kind", interface: "Interface", capacityGB: "Capacity (GB)", readMBs: "Read (MB/s)", writeMBs: "Write (MB/s)",
  wattage: "Output (W)", efficiency: "Efficiency", modular: "Modular cables", style: "Style",
  supportedMotherboards: "Board sizes", maxGpuLengthMm: "Longest graphics card (mm)", maxCoolerHeightMm: "Tallest cooler (mm)",
  psuFormFactors: "Power supply sizes", includedFans: "Fans included", driveBays: "Drive bays", sockets: "Sockets",
  heightMm: "Height (mm)", tdpRatingW: "Rated for (W)", radiatorMm: "Radiator (mm)", standard: "Standard",
  sizeIn: "Size (in)", widthPx: "Width (px)", heightPx: "Height (px)", refreshHz: "Refresh rate (Hz)", panel: "Panel type",
  brightnessNits: "Brightness (nits)", touch: "Touch", capacityWh: "Capacity (Wh)", chemistry: "Chemistry",
  capacityVA: "Rating (VA)", outputW: "Usable output (W)", topology: "Type", waveform: "Output on battery",
  outlets: "Battery-backed outlets", usbLink: "USB link for auto shutdown",
};

/** Numeric spec fields where one direction is plainly better. Anything not listed is shown without a winner. */
export const BETTER: Record<string, "higher" | "lower"> = {
  cores: "higher", threads: "higher", baseGHz: "higher", boostGHz: "higher", pcieGen: "higher",
  ramSlots: "higher", maxRamGB: "higher", m2Slots: "higher", sataPorts: "higher", pcieX16Slots: "higher",
  moduleGB: "higher", modules: "higher", speedMTs: "higher", casLatency: "lower", vramGB: "higher",
  capacityGB: "higher", readMBs: "higher", writeMBs: "higher", wattage: "higher",
  maxGpuLengthMm: "higher", maxCoolerHeightMm: "higher", includedFans: "higher", tdpRatingW: "higher",
  refreshHz: "higher", brightnessNits: "higher", widthPx: "higher", heightPx: "higher", capacityWh: "higher", capacityVA: "higher", outputW: "higher", outlets: "higher",
};

export const showValue = (v: unknown): string =>
  v === null || v === undefined ? "None" : typeof v === "boolean" ? (v ? "Yes" : "No") : Array.isArray(v) ? v.join(", ") : String(v);

export const sizeGB = (gb: number) => (gb >= 1000 ? `${+(gb / 1000).toFixed(1)} TB` : `${gb} GB`);

export const partName = (p: { brand: string; model: string }) => `${p.brand} ${p.model}`;

export const money = (amount: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
