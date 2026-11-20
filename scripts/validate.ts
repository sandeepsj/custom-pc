/** Checks every JSON file under data/ against the schema and cross-references. Run after adding or editing data. */
import { loadData } from "../server/data";

const d = await loadData();
console.log(`${d.parts.size} parts and ${d.machines.size} machines loaded.`);
if (d.problems.length) {
  console.error(`\n${d.problems.length} problem(s):`);
  for (const p of d.problems) console.error(`  ${p.file}\n    ${p.message}`);
  process.exit(1);
}
console.log("All data is valid.");
