/**
 * One-off script to read reference Excel files and print their contents.
 * Run: node scripts/read-references.js
 */
import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const refDir = join(__dirname, '..', 'references');

function readSheet(path) {
  const buf = readFileSync(path);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const out = {};
  wb.SheetNames.forEach((name) => {
    const sheet = wb.Sheets[name];
    out[name] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  });
  return out;
}

console.log('=== Process Duration.xlsx ===');
try {
  const dur = readSheet(join(refDir, 'Process Duration.xlsx'));
  console.log(JSON.stringify(dur, null, 2));
} catch (e) {
  console.error(e.message);
}

console.log('\n=== Loaf Line Process Chart-  (1).xlsx ===');
try {
  const loaf = readSheet(join(refDir, 'Loaf Line Process Chart-  (1).xlsx'));
  console.log(JSON.stringify(loaf, null, 2));
} catch (e) {
  console.error(e.message);
}

console.log('\n=== Switching Time.xlsx ===');
try {
  const sw = readSheet(join(refDir, 'Switching Time.xlsx'));
  console.log(JSON.stringify(sw, null, 2));
} catch (e) {
  console.error(e.message);
}

console.log('\n=== loafline stroke ang capacity orig.xlsx ===');
try {
  const cap = readSheet(join(refDir, 'loafline stroke ang capacity orig.xlsx'));
  console.log(JSON.stringify(cap, null, 2));
} catch (e) {
  console.error(e.message);
}

console.log('\n=== Yield & Batch Size 2.xlsx ===');
try {
  const y = readSheet(join(refDir, 'Yield & Batch Size 2.xlsx'));
  console.log(JSON.stringify(y, null, 2));
} catch (e) {
  console.error(e.message);
}
