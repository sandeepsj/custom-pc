/**
 * Turns a Selection (part ids per slot) into a priced, checked build.
 * Pure functions over the JSON data: no I/O. The server calls this; the frontend only renders the result.
 */
import { partName, sizeGB as gb } from "./labels";
import type { Listing, Part, PartOf, PartType, Selection } from "./schema";

export { partName };

export interface Price {
  amount: number;
  currency: string;
  seller: string;
  url: string;
  inStock: boolean;
}

export type Priced<T> = T & { bestPrice: Price | null };

export type CheckStatus = "ok" | "warn" | "fail" | "info";
export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface Line {
  slot: PartType;
  qty: number;
  part: Priced<Part> | null;
  /** Set when the selection points at an id that has no JSON file. */
  missingId?: string;
  lineTotal: number | null;
}

export interface Headroom {
  label: string;
  value: string;
  detail: string;
  /** good = room to grow, tight = little or none. */
  tone: "good" | "tight" | "neutral";
}

export interface Step {
  title: string;
  detail: string;
}

export interface SlotUsage {
  ramSlots: { used: number; total: number } | null;
  m2: { used: number; total: number } | null;
  sata: { used: number; total: number } | null;
}

export interface Summary {
  cpu: string | null;
  cores: number | null;
  threads: number | null;
  ramGB: number;
  ramType: string | null;
  storageGB: number;
  storageType: string | null;
  gpu: string | null;
  wifi: string | null;
  bluetooth: string | null;
  display: string | null;
  batteryWh: number | null;
  estimatedDrawW: number;
}

export interface Evaluated {
  lines: Line[];
  total: { amount: number; currency: string } | null;
  /** Replaceable parts that have no listing yet. */
  unpricedCount: number;
  /** Soldered or built-in parts, which have no price of their own. */
  builtInCount: number;
  checks: Check[];
  headroom: Headroom[];
  steps: Step[];
  usage: SlotUsage;
  summary: Summary;
}

export function bestPrice(listings: Listing[]): Price | null {
  if (!listings.length) return null;
  const pool = listings.some((l) => l.inStock) ? listings.filter((l) => l.inStock) : listings;
  const l = pool.reduce((a, b) => (b.price < a.price ? b : a));
  return { amount: l.price, currency: l.currency, seller: l.seller, url: l.url, inStock: l.inStock };
}

export const withPrice = <T extends { listings: Listing[] }>(x: T): Priced<T> => ({
  ...x,
  bestPrice: bestPrice(x.listings),
});


export function evaluate(sel: Selection, parts: Map<string, Part>): Evaluated {
  const lines: Line[] = [];
  const get = <T extends PartType>(slot: T, id: string | undefined, qty = 1): PartOf<T> | undefined => {
    if (!id) return undefined;
    const p = parts.get(id);
    if (!p || p.type !== slot) {
      lines.push({ slot, qty, part: null, missingId: id, lineTotal: null });
      return undefined;
    }
    const priced = withPrice(p);
    lines.push({
      slot,
      qty,
      part: priced,
      lineTotal: priced.bestPrice ? priced.bestPrice.amount * qty : null,
    });
    return p as PartOf<T>;
  };

  const cpu = get("cpu", sel.cpu);
  const mb = get("motherboard", sel.motherboard);
  const ram = sel.ram.flatMap((r) => {
    const p = get("ram", r.id, r.qty);
    return p ? [{ part: p, qty: r.qty }] : [];
  });
  const storage = sel.storage.flatMap((s) => {
    const p = get("storage", s.id, s.qty);
    return p ? [{ part: p, qty: s.qty }] : [];
  });
  const gpu = get("gpu", sel.gpu);
  const psu = get("psu", sel.psu);
  const pcCase = get("case", sel.case);
  const cooler = get("cooler", sel.cooler);
  const wifi = get("wifi", sel.wifi);
  const display = get("display", sel.display);
  const battery = get("battery", sel.battery);
  const ups = get("ups", sel.ups);

  const checks: Check[] = [];
  const add = (id: string, label: string, status: CheckStatus, detail: string) =>
    checks.push({ id, label, status, detail });

  for (const l of lines)
    if (l.missingId)
      add(`missing-${l.missingId}`, "Unknown part", "fail", `No ${l.slot} with id "${l.missingId}" exists in data/parts/${l.slot}/.`);

  // Totals
  const socketed = ram.filter((r) => r.part.specs.formFactor !== "Soldered");
  const sticks = socketed.reduce((n, r) => n + r.part.specs.modules * r.qty, 0);
  const allSticks = ram.reduce((n, r) => n + r.part.specs.modules * r.qty, 0);
  const solderedGB = ram.filter((r) => r.part.specs.formFactor === "Soldered").reduce((n, r) => n + r.part.specs.modules * r.part.specs.moduleGB * r.qty, 0);
  const cpuFixed = cpu?.replaceable === false;
  const ramGB = ram.reduce((n, r) => n + r.part.specs.modules * r.part.specs.moduleGB * r.qty, 0);
  const m2Used = storage.filter((s) => s.part.specs.interface === "nvme").reduce((n, s) => n + s.qty, 0);
  const sataUsed = storage.filter((s) => s.part.specs.interface === "sata").reduce((n, s) => n + s.qty, 0);
  const storageGB = storage.reduce((n, s) => n + s.part.specs.capacityGB * s.qty, 0);
  const draw = (cpu?.specs.tdpW ?? 0) + (gpu?.specs.tdpW ?? 0) + (cpu || gpu ? 75 : 0);

  // CPU and motherboard
  if (cpu && mb) {
    const ok = cpu.specs.socket === mb.specs.socket;
    add("socket", "CPU socket", ok ? "ok" : "fail",
      ok ? `Both use ${mb.specs.socket}.` : `The CPU needs ${cpu.specs.socket} but the board is ${mb.specs.socket}.`);
  }

  // Memory
  if (ram.length && mb) {
    const wrong = ram.find((r) => r.part.specs.memoryType !== mb.specs.memoryType);
    add("ram-type", "Memory type", wrong ? "fail" : "ok",
      wrong
        ? `${partName(wrong.part)} is ${wrong.part.specs.memoryType}; the board takes ${mb.specs.memoryType} only.`
        : `All memory is ${mb.specs.memoryType}, which the board takes.`);
    const misfit = socketed.find((r) => r.part.specs.formFactor !== mb.specs.ramFormFactor);
    if (misfit)
      add("ram-form", "Memory stick size", "fail", `${partName(misfit.part)} is a ${misfit.part.specs.formFactor} stick; the board takes ${mb.specs.ramFormFactor}.`);
    add("ram-slots", "Memory slots", sticks > mb.specs.ramSlots ? "fail" : "ok",
      `${sticks} of ${mb.specs.ramSlots} ${mb.specs.ramSlots === 1 ? "slot" : "slots"} used${solderedGB ? `, plus ${solderedGB} GB soldered to the board` : ""}.`);
    if (ramGB > mb.specs.maxRamGB)
      add("ram-max", "Memory capacity", "fail", `${ramGB} GB is more than the board's ${mb.specs.maxRamGB} GB limit.`);
    if (allSticks === 1 && solderedGB === 0)
      add("ram-dual", "Dual channel", "warn", "A single stick runs in single-channel mode. Two matched sticks are faster, especially with integrated graphics.");
  }
  if (ram.length && cpu) {
    const wrong = ram.find((r) => !cpu.specs.memoryTypes.includes(r.part.specs.memoryType));
    if (wrong)
      add("ram-cpu", "Memory and CPU", "fail", `${partName(cpu)} does not support ${wrong.part.specs.memoryType}.`);
  }

  // Storage
  if (storage.length && mb) {
    add("m2", "M.2 slots", m2Used > mb.specs.m2Slots ? "fail" : "ok", `${m2Used} of ${mb.specs.m2Slots} M.2 slots used.`);
    if (sataUsed)
      add("sata", "SATA ports", sataUsed > mb.specs.sataPorts ? "fail" : "ok", `${sataUsed} of ${mb.specs.sataPorts} SATA ports used.`);
  }

  // Display output
  if (cpu && !gpu) {
    const igpu = cpu.specs.integratedGraphics;
    add("display", "Display output", igpu ? "ok" : "fail",
      igpu
        ? `No graphics card, so the monitor runs from the CPU's ${igpu} through the board's ports.`
        : `${partName(cpu)} has no integrated graphics. Add a graphics card or nothing will show on the monitor.`);
  }

  // Case fit
  if (mb && pcCase) {
    const ok = pcCase.specs.supportedMotherboards.includes(mb.specs.formFactor);
    add("board-fit", "Board fits case", ok ? "ok" : "fail",
      ok ? `The case takes ${mb.specs.formFactor} boards.` : `The board is ${mb.specs.formFactor}; the case takes ${pcCase.specs.supportedMotherboards.join(", ")}.`);
  }
  if (gpu && pcCase) {
    const ok = gpu.specs.lengthMm <= pcCase.specs.maxGpuLengthMm;
    add("gpu-fit", "Graphics card length", ok ? "ok" : "fail",
      `Card is ${gpu.specs.lengthMm} mm; the case allows ${pcCase.specs.maxGpuLengthMm} mm.`);
  }
  if (psu && pcCase) {
    const ok = pcCase.specs.psuFormFactors.includes(psu.specs.formFactor);
    add("psu-fit", "Power supply fits case", ok ? "ok" : "fail",
      ok ? `The case takes ${psu.specs.formFactor} power supplies.` : `The supply is ${psu.specs.formFactor}; the case takes ${pcCase.specs.psuFormFactors.join(", ")}.`);
  }

  // Cooling
  if (cpu && !cooler && !cpuFixed)
    add("cooler", "CPU cooler", cpu.specs.coolerIncluded ? "ok" : "fail",
      cpu.specs.coolerIncluded ? "Using the cooler that comes in the CPU box." : "This CPU ships without a cooler. Add one.");
  if (cooler && cpu) {
    const ok = cooler.specs.sockets.includes(cpu.specs.socket);
    add("cooler-socket", "Cooler mount", ok ? "ok" : "fail",
      ok ? `The cooler mounts on ${cpu.specs.socket}.` : `The cooler has no ${cpu.specs.socket} mount.`);
    if (cooler.specs.tdpRatingW < cpu.specs.tdpW)
      add("cooler-tdp", "Cooler capacity", "warn", `Cooler is rated for ${cooler.specs.tdpRatingW} W; the CPU is ${cpu.specs.tdpW} W.`);
  }
  if (cooler && pcCase && cooler.specs.kind === "air") {
    const ok = cooler.specs.heightMm <= pcCase.specs.maxCoolerHeightMm;
    add("cooler-fit", "Cooler height", ok ? "ok" : "fail",
      `Cooler is ${cooler.specs.heightMm} mm tall; the case allows ${pcCase.specs.maxCoolerHeightMm} mm.`);
  }

  // Power
  if (psu && (cpu || gpu)) {
    const wanted = Math.ceil((draw * 1.3) / 10) * 10;
    const status: CheckStatus = psu.specs.wattage < draw ? "fail" : psu.specs.wattage < wanted ? "warn" : "ok";
    add("power", "Power supply size", status,
      `Estimated draw is about ${draw} W. With 30% margin that is ${wanted} W; the supply gives ${psu.specs.wattage} W.`);
    if (gpu && psu.specs.wattage < gpu.specs.recommendedPsuW)
      add("power-gpu", "Graphics card power", "warn", `The card's maker recommends a ${gpu.specs.recommendedPsuW} W supply.`);
  }

  // Power backup. A desktop has no battery, so a power cut switches it off unless a UPS carries it.
  if (ups && (cpu || gpu)) {
    const withMonitor = draw + 50;
    const status: CheckStatus = ups.specs.outputW < draw ? "fail" : ups.specs.outputW < withMonitor ? "warn" : "ok";
    add("ups", "UPS size", status,
      `The PC draws about ${draw} W at full load, or ${withMonitor} W with a monitor. The UPS can supply ${ups.specs.outputW} W.`);
    if (ups.specs.waveform === "simulated sine")
      add("ups-wave", "UPS output", "info", "This UPS gives a stepped sine wave on battery. Most power supplies accept it; a few switch off or buzz.");
  } else if (!ups && !battery && psu) {
    add("ups", "Power cuts", "info", "No UPS chosen, so a power cut switches the PC off at once.");
  }

  // Wireless
  const wifiName = wifi?.specs.standard ?? mb?.specs.wifi ?? null;
  const btName = wifi?.specs.bluetooth ?? mb?.specs.bluetooth ?? null;
  if (mb && !wifiName)
    add("wifi", "Wi-Fi", "info", "The board has no Wi-Fi. Use Ethernet or add a Wi-Fi card.");

  // Price
  const priced = lines.filter((l) => l.lineTotal !== null);
  const currencies = new Set(priced.map((l) => l.part!.bestPrice!.currency));
  if (currencies.size > 1)
    add("currency", "Mixed currencies", "warn", `Prices are in ${[...currencies].join(", ")}; the total adds them without converting.`);
  const total = priced.length
    ? { amount: priced.reduce((n, l) => n + l.lineTotal!, 0), currency: [...currencies][0]! }
    : null;

  // Upgrade headroom
  const headroom: Headroom[] = [];
  if (mb) {
    const free = mb.specs.ramSlots - sticks;
    headroom.push({
      label: "Memory",
      value: free > 0 ? `${free} free ${free === 1 ? "slot" : "slots"}` : "No free slots",
      detail: `${ramGB} GB installed${solderedGB ? `, ${solderedGB} GB of it soldered` : ""}. The board takes up to ${mb.specs.maxRamGB} GB${
        free > 0 ? ", so you can add sticks later" : mb.specs.ramSlots > 0 ? ", so more memory means replacing a stick" : ", and none of it can be changed"
      }.`,
      tone: free > 0 ? "good" : "tight",
    });
    const m2Free = mb.specs.m2Slots - m2Used;
    const sataFree = mb.specs.sataPorts - sataUsed;
    headroom.push({
      label: "Storage",
      value: `${Math.max(m2Free, 0)} M.2, ${Math.max(sataFree, 0)} SATA free`,
      detail: `${gb(storageGB)} installed. Each free connector takes another drive.`,
      tone: m2Free + sataFree > 0 ? "good" : "tight",
    });
    headroom.push(
      cpuFixed
        ? { label: "Processor", value: "Soldered", detail: "The processor is part of the board and cannot be changed.", tone: "tight" }
        : {
            label: "Processor",
            value: `${mb.specs.socket} socket`,
            detail: `Any ${mb.specs.socket} CPU the board's firmware supports drops in. Check the maker's CPU support list before buying.`,
            tone: "neutral",
          },
    );
    headroom.push({
      label: "Graphics",
      value: gpu ? "Card installed" : mb.specs.pcieX16Slots > 0 ? "Slot free" : "No slot",
      detail: !gpu && mb.specs.pcieX16Slots === 0
        ? "There is nowhere to fit a graphics card."
        : gpu
        ? `Swap the card any time${pcCase ? `; the case fits cards up to ${pcCase.specs.maxGpuLengthMm} mm` : ""}.`
        : `A full-length PCIe ${mb.specs.pcieGen}.0 slot is waiting${pcCase ? `; the case fits cards up to ${pcCase.specs.maxGpuLengthMm} mm` : ""}.`,
      tone: mb.specs.pcieX16Slots > 0 ? "good" : "tight",
    });
  }
  if (psu) {
    const spare = psu.specs.wattage - Math.ceil(draw * 1.3);
    headroom.push({
      label: "Power",
      value: spare > 0 ? `${spare} W spare` : "No spare power",
      detail: `After a 30% margin on today's ${draw} W draw. ${spare >= 150 ? "Enough to add or step up a graphics card." : "A bigger graphics card would need a bigger supply."}`,
      tone: spare >= 150 ? "good" : spare > 0 ? "neutral" : "tight",
    });
  }

  // Assembly order
  const steps: Step[] = [];
  const step = (title: string, detail: string) => steps.push({ title, detail });
  if (cpu && mb)
    step("Seat the CPU", `Lift the ${mb.specs.socket} retention arm, match the triangle on ${partName(cpu)} to the socket corner, lower it in and close the arm.`);
  if (ram.length && mb)
    step("Fit the memory", sticks === 2 && mb.specs.ramSlots === 4
      ? "Use the second and fourth slots from the CPU (A2 and B2) so the pair runs in dual channel. Press until both clips click."
      : `Press ${sticks} ${sticks === 1 ? "stick" : "sticks"} into the slots until the clips click. The board manual shows which slots to fill first.`);
  if (m2Used)
    step("Mount the M.2 drive", "Slide the drive into the M.2 slot at an angle, press it flat and fix it with the screw or latch. Do this before the cooler blocks access.");
  if (cpu && (cooler || cpu.specs.coolerIncluded))
    step("Mount the cooler", cooler
      ? `Fit the ${cpu.specs.socket} bracket for ${partName(cooler)}, apply thermal paste if none is pre-applied, tighten in a cross pattern and plug the fan into CPU_FAN.`
      : "Fit the boxed cooler over the pre-applied paste, tighten in a cross pattern and plug the fan into CPU_FAN.");
  if (pcCase && mb)
    step("Put the board in the case", `Fit the I/O shield if it is separate, check the standoffs match the ${mb.specs.formFactor} hole pattern, then screw the board down.`);
  if (psu && pcCase)
    step("Install the power supply", `Mount ${partName(psu)} fan-down if the case has a bottom vent. Route the 24-pin and CPU power cables behind the tray and plug them in.`);
  if (sataUsed)
    step("Add SATA drives", "Fix each drive in a bay, then connect a SATA data cable to the board and a SATA power cable from the supply.");
  if (gpu)
    step("Install the graphics card", `Remove the matching slot covers, press ${partName(gpu)} into the top long slot until it latches, screw it to the case and connect ${gpu.specs.powerConnectors} power.`);
  if (wifi)
    step("Add the Wi-Fi card", wifi.specs.interface === "USB" ? "Plug the adapter into a rear USB port." : "Fit the card in a free slot and screw on the antennas.");
  if (ups)
    step("Set up the UPS", `Charge ${partName(ups)} for a few hours first. Plug the PC and monitor into its battery-backed outlets${ups.specs.usbLink ? ", and connect its USB cable so the PC can shut itself down when the battery runs low" : ""}.`);
  if (pcCase)
    step("Connect the case", "Plug in the front-panel power switch, USB and audio headers, and the case fans. The board manual has the pin layout.");
  if (steps.length)
    step("First start", `Connect the monitor to ${gpu ? "the graphics card" : "the board's video port"}, power on and open the firmware setup. Check that all memory and drives show up, turn on the memory speed profile (EXPO or XMP), then install the operating system.`);

  return {
    lines,
    total,
    unpricedCount: lines.filter((l) => l.part && l.lineTotal === null && l.part.replaceable !== false).length,
    builtInCount: lines.filter((l) => l.part && l.lineTotal === null && l.part.replaceable === false).length,
    checks,
    headroom,
    steps,
    usage: {
      ramSlots: mb ? { used: sticks, total: mb.specs.ramSlots } : null,
      m2: mb ? { used: m2Used, total: mb.specs.m2Slots } : null,
      sata: mb ? { used: sataUsed, total: mb.specs.sataPorts } : null,
    },
    summary: {
      cpu: cpu ? partName(cpu) : null,
      cores: cpu?.specs.cores ?? null,
      threads: cpu?.specs.threads ?? null,
      ramGB,
      ramType: ram[0]?.part.specs.memoryType ?? null,
      storageGB,
      storageType: storage.length
        ? [...new Set(storage.map((s) => (s.part.specs.interface === "nvme" ? "NVMe SSD" : s.part.specs.kind === "hdd" ? "hard disk" : "SATA SSD")))].join(" + ")
        : null,
      gpu: gpu ? `${gpu.specs.chipset} ${gpu.specs.vramGB} GB` : cpu?.specs.integratedGraphics ?? null,
      wifi: wifiName,
      bluetooth: btName,
      display: display ? `${display.specs.sizeIn} in ${display.specs.panel}, ${display.specs.widthPx}x${display.specs.heightPx}, ${display.specs.refreshHz} Hz` : null,
      batteryWh: battery?.specs.capacityWh ?? null,
      estimatedDrawW: draw,
    },
  };
}
