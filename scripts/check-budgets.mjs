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

function assertMaximum(name, value, limit) {
  if (value > limit) throw new Error(`Budget excedido: ${name} (${value} > ${limit})`);
  return { budget: name, value, limit: `<= ${limit}` };
}

function assertRange(name, value, range) {
  if (value < range.min || value > range.max) {
    throw new Error(
      `Budget fora da faixa: ${name} (${value}; esperado ${range.min}..${range.max})`,
    );
  }
  return { budget: name, value, limit: `${range.min}..${range.max}` };
}

const files = listFiles(dist);
const javascript = files.filter((file) => file.endsWith('.js'));
const css = files.filter((file) => file.endsWith('.css'));
const canonicalGlb = path.join(dist, 'assets/geometry/karv-chair/v2/base.glb');

const measurements = {
  canonicalGlbBytes: fs.statSync(canonicalGlb).size,
  triangleCount: manifest.statistics.triangle_count,
  uploadVertexCount: manifest.statistics.upload_vertex_count,
  widthMeters: manifest.dimensions_m.width_x,
  heightMeters: manifest.dimensions_m.height_y,
  depthMeters: manifest.dimensions_m.depth_z,
  largestJavaScriptBytes: Math.max(...javascript.map((file) => fs.statSync(file).size)),
  javascriptTotalBytes: totalBytes(javascript),
  cssTotalBytes: totalBytes(css),
  distTotalBytes: totalBytes(files),
};

if (measurements.canonicalGlbBytes !== manifest.asset.byte_length) {
  throw new Error('GLB publicado diverge do manifesto canônico.');
}

const rows = [
  assertMaximum(
    'canonicalGlbBytes',
    measurements.canonicalGlbBytes,
    budgets.geometry.canonicalGlbBytes,
  ),
  assertMaximum('triangleCount', measurements.triangleCount, budgets.geometry.triangleCount),
  assertMaximum(
    'uploadVertexCount',
    measurements.uploadVertexCount,
    budgets.geometry.uploadVertexCount,
  ),
  assertRange('widthMeters', measurements.widthMeters, budgets.geometry.widthMeters),
  assertRange('heightMeters', measurements.heightMeters, budgets.geometry.heightMeters),
  assertRange('depthMeters', measurements.depthMeters, budgets.geometry.depthMeters),
  assertMaximum(
    'largestJavaScriptBytes',
    measurements.largestJavaScriptBytes,
    budgets.build.largestJavaScriptBytes,
  ),
  assertMaximum(
    'javascriptTotalBytes',
    measurements.javascriptTotalBytes,
    budgets.build.javascriptTotalBytes,
  ),
  assertMaximum('cssTotalBytes', measurements.cssTotalBytes, budgets.build.cssTotalBytes),
  assertMaximum('distTotalBytes', measurements.distTotalBytes, budgets.build.distTotalBytes),
];

console.table(rows);
console.log('Budgets: PASS');
