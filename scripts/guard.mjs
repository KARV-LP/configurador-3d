import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoots = ['index.html', 'src', 'vite.config.ts', 'netlify.toml'];
const textExtensions = new Set(['.css', '.html', '.ts', '.tsx', '.toml']);

const rules = [
  {
    name: 'identificador técnico do GLB',
    pattern:
      /\b(?:Material\.\d+|ASSENTO|ENCOSTO_[A-Z_]+|LATERAL_[A-Z_]+|PEZINHOS|VIVO_[A-Z_]+)\b/gu,
  },
  {
    name: 'metadata privada',
    pattern:
      /(?:['"])?(?:supplier|vendor|fornecedor|cost|custo|margin|private_sku)(?:['"])?\s*:/giu,
    extensions: new Set(['.html', '.ts', '.tsx']),
  },
  {
    name: 'CDN runtime proibida',
    pattern:
      /https?:\/\/(?:ajax\.googleapis\.com|cdn\.jsdelivr\.net|unpkg\.com|www\.gstatic\.com|modelviewer\.dev)\b/giu,
  },
  {
    name: 'segredo provável no código público',
    pattern:
      /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,})\b/gu,
  },
];

function listTextFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];

  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) return listTextFiles(child);
    return textExtensions.has(path.extname(entry.name)) ? [child] : [];
  });
}

export function scanText(text, extension = '.ts') {
  return rules.flatMap((rule) => {
    if (rule.extensions && !rule.extensions.has(extension)) return [];
    rule.pattern.lastIndex = 0;
    return [...text.matchAll(rule.pattern)].map((match) => ({
      rule: rule.name,
      token: match[0],
    }));
  });
}

const selfTest = scanText(
  'Material.012, "supplier": "private", https://unpkg.com/example.js, ghp_12345678901234567890',
);
if (selfTest.length !== 4) {
  throw new Error('Autoteste interno do guard falhou.');
}

const violations = sourceRoots
  .flatMap((relative) => listTextFiles(path.join(root, relative)))
  .flatMap((file) =>
    scanText(fs.readFileSync(file, 'utf8'), path.extname(file)).map((violation) => ({
      file: path.relative(root, file),
      ...violation,
    })),
  );

const runtimeSetup = fs.readFileSync(path.join(root, 'src/3d/model-viewer-runtime.ts'), 'utf8');
if (!runtimeSetup.includes('ModelViewerElement.dracoDecoderLocation = dracoDecoderUrl')) {
  violations.push({
    file: 'src/3d/model-viewer-runtime.ts',
    rule: 'decoder Draco local ausente',
    token: 'dracoDecoderLocation',
  });
}

if (violations.length > 0) {
  console.error(JSON.stringify(violations, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Guard: PASS (${sourceRoots.join(', ')})`);
}
