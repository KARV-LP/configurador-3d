import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const budgets = JSON.parse(fs.readFileSync(path.join(root, 'budgets.json'), 'utf8'));
const canonicalGlb = path.join(root, 'assets/geometry/karv-chair/v2/base.glb');
const dist = path.join(root, 'dist');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function assertBudget(label, actual, maximum) {
  if (actual > maximum) {
    throw new Error(`${label}: ${actual} bytes excede budget de ${maximum} bytes`);
  }
  console.log(`✓ ${label}: ${actual}/${maximum} bytes`);
}

assertBudget(
  'GLB canônico',
  fs.statSync(canonicalGlb).size,
  budgets.canonical_glb_max_bytes,
);

if (!fs.existsSync(dist)) throw new Error('dist/ ausente; execute vite build antes do budget');

const files = walk(dist);
const sum = (extension) =>
  files
    .filter((file) => path.extname(file) === extension)
    .reduce((total, file) => total + fs.statSync(file).size, 0);
const nonGlbTotal = files
  .filter((file) => path.extname(file) !== '.glb')
  .reduce((total, file) => total + fs.statSync(file).size, 0);

assertBudget('JavaScript de build', sum('.js'), budgets.build_js_total_max_bytes);
assertBudget('CSS de build', sum('.css'), budgets.build_css_total_max_bytes);
assertBudget(
  'Build sem GLB',
  nonGlbTotal,
  budgets.build_total_excluding_glb_max_bytes,
);
