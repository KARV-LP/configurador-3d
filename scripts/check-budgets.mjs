import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const budgets = JSON.parse(fs.readFileSync(path.join(root, 'budgets.json'), 'utf8'));
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'assets/geometry/karv-chair/v2/base.manifest.json'), 'utf8'),
);

if (!fs.existsSync(dist)) {
  throw new Error('Diretório dist ausente. Execute npm run build antes do budget.');
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(file) : [file];
  });
}

function totalBytes(files) {
  return files.reduce((total, file) => total + fs.statSync(file).size, 0);
}

const files = listFiles(dist);
const javascript = files.filter((file) => file.endsWith('.js'));
const css = files.filter((file) => file.endsWith('.css'));
const canonicalGlb = path.join(dist, 'assets/geometry/karv-chair/v2/base.glb');
const measurements = {
  canonicalGlbBytes: fs.statSync(canonicalGlb).size,
  largestJavaScriptBytes: Math.max(...javascript.map((file) => fs.statSync(file).size)),
  javascriptTotalBytes: totalBytes(javascript),
  cssTotalBytes: totalBytes(css),
  distTotalBytes: totalBytes(files),
};

if (measurements.canonicalGlbBytes !== manifest.asset.byte_length) {
  throw new Error('GLB publicado diverge do manifesto canônico.');
}

const exceeded = Object.entries(measurements).filter(([name, value]) => value > budgets[name]);
console.table(
  Object.entries(measurements).map(([name, value]) => ({
    budget: name,
    bytes: value,
    limit: budgets[name],
  })),
);

if (exceeded.length > 0) {
  throw new Error(`Budgets excedidos: ${exceeded.map(([name]) => name).join(', ')}`);
}

console.log('Budgets: PASS');
