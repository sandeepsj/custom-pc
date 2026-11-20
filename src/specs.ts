/** How each part type is labelled and summarised. Display only: no data lives here. */
import { showValue as show, sizeGB as size, SPEC_LABELS as LABELS } from "../shared/labels";
import type { Part } from "../shared/schema";

export { KIND_LABEL, money, partName, sizeGB as size, TYPE_LABEL } from "../shared/labels";

/** The handful of specs worth a table column, per type. */
export function highlights(p: Part): [string, string][] {
  switch (p.type) {
    case "cpu":
      return [["Socket", p.specs.socket], ["Cores / threads", `${p.specs.cores} / ${p.specs.threads}`], ["Boost", `${p.specs.boostGHz} GHz`], ["Power", `${p.specs.tdpW} W`], ["Graphics", p.specs.integratedGraphics ?? "None"]];
    case "motherboard":
      return [["Socket", p.specs.socket], ["Size", p.specs.formFactor], ["Memory", `${p.specs.ramSlots}x ${p.specs.memoryType}`], ["M.2 slots", `${p.specs.m2Slots}`], ["Wi-Fi", p.specs.wifi ?? "None"]];
    case "ram":
      return [["Type", `${p.specs.memoryType} ${p.specs.formFactor === "DIMM" ? "" : p.specs.formFactor}`.trim()], ["Kit", `${p.specs.modules}x ${p.specs.moduleGB} GB`], ["Speed", `${p.specs.speedMTs} MT/s`], ["Latency", p.specs.casLatency ? `CL${p.specs.casLatency}` : "Not stated"]];
    case "gpu":
      return [["Chip", p.specs.chipset], ["Memory", `${p.specs.vramGB} GB`], ["Length", `${p.specs.lengthMm} mm`], ["Power", `${p.specs.tdpW} W`]];
    case "storage":
      return [["Type", p.specs.interface === "nvme" ? "NVMe SSD" : p.specs.kind === "hdd" ? "Hard disk" : "SATA SSD"], ["Capacity", size(p.specs.capacityGB)], ["Read", p.specs.readMBs ? `${p.specs.readMBs} MB/s` : "Not stated"], ["Write", p.specs.writeMBs ? `${p.specs.writeMBs} MB/s` : "Not stated"]];
    case "psu":
      return [["Output", `${p.specs.wattage} W`], ["Efficiency", p.specs.efficiency], ["Modular cables", p.specs.modular === "no" ? "No" : p.specs.modular === "full" ? "Fully" : "Partly"], ["Size", p.specs.formFactor]];
    case "case":
      return [["Style", p.specs.style], ["Boards", p.specs.supportedMotherboards.join(", ")], ["Max card", `${p.specs.maxGpuLengthMm} mm`], ["Max cooler", `${p.specs.maxCoolerHeightMm} mm`]];
    case "cooler":
      return [["Type", p.specs.kind === "air" ? "Air tower" : "Liquid"], ["Height", `${p.specs.heightMm} mm`], ["Rated for", `${p.specs.tdpRatingW} W`], ["Mounts", p.specs.sockets.join(", ")]];
    case "display":
      return [["Size", `${p.specs.sizeIn} in`], ["Resolution", `${p.specs.widthPx}x${p.specs.heightPx}`], ["Refresh", `${p.specs.refreshHz} Hz`], ["Panel", p.specs.panel]];
    case "battery":
      return [["Capacity", `${p.specs.capacityWh} Wh`], ["Chemistry", p.specs.chemistry ?? "Not stated"]];
    case "ups":
      return [["Rating", `${p.specs.capacityVA} VA`], ["Usable output", `${p.specs.outputW} W`], ["Type", p.specs.topology], ["On battery", p.specs.waveform]];
    case "wifi":
      return [["Standard", p.specs.standard], ["Bluetooth", p.specs.bluetooth ?? "None"], ["Connects by", p.specs.interface]];
  }
}

/** Every spec in the JSON, labelled, for the detail view. Unknown keys fall back to the raw key. */
export function allSpecs(p: Part): [string, string][] {
  const rows = Object.entries(p.specs).map(([k, v]) => [LABELS[k] ?? k, show(v)] as [string, string]);
  if (p.series) rows.unshift(["Series", p.series]);
  if (p.releaseYear) rows.push(["Released", String(p.releaseYear)]);
  if (p.replaceable === false) rows.push(["Replaceable", "No, built in"]);
  for (const [k, v] of Object.entries(p.extra ?? {})) rows.push([k, show(v)]);
  return rows;
}
