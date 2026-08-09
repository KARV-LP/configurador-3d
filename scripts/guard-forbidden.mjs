import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const forbidden = [
  'wi' + 'ler',
  'ajax.googleapis.com/ajax/libs/' + 'model-viewer',
  'unpkg.com/@google/' + 'model-viewer',
  'cdn.jsdelivr.net/npm/@google/' + 'model-viewer',
];

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.toml',
  '.ts',
  '.tsx',
  '.yml',
  '.yaml',
]);

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const violations = [];
for (const file of tracked) {
  const extension = file.slice(file.lastIndexOf('.'));
  if (!textExtensions.has(extension)) continue;

  const content = fs.readFileSync(file, 'utf8').toLowerCase();
  for (const token of forbidden) {
    if (content.includes(token.toLowerCase())) violations.push(`${file}: ${token}`);
  }
}

if (violations.length) {
  console.error('Guard falhou. Tokens proibidos encontrados:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`Guard aprovado: ${tracked.length} arquivos versionados verificados.`);
