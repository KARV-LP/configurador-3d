#!/usr/bin/env node
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { processKarvFabric } from '../src/pipeline/karv-fabric-pipeline.mjs';

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--all') result.all = argv[++index];
    else if (argument === '--input') result.input = argv[++index];
    else if (argument === '--output') result.output = argv[++index];
    else if (argument === '--fabric-id') result.fabricId = argv[++index];
    else throw new Error(`Argumento desconhecido: ${argument}`);
  }
  return result;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (!args.output) throw new Error('Informe --output.');

  if (args.all) {
    if (args.input || args.fabricId) {
      throw new Error('Use --all ou --input/--fabric-id, nunca os dois modos juntos.');
    }
    const sourceRoot = path.resolve(args.all);
    const outputRoot = path.resolve(args.output);
    const entries = (await readdir(sourceRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));
    if (entries.length === 0) throw new Error(`Nenhum tecido encontrado em ${sourceRoot}.`);
    for (const entry of entries) {
      await processKarvFabric({
        inputDirectory: path.join(sourceRoot, entry.name),
        outputDirectory: path.join(outputRoot, entry.name),
        fabricId: entry.name,
      });
      console.log(`Tecido processado: ${entry.name}`);
    }
    return;
  }

  if (!args.input || !args.fabricId) {
    throw new Error('Informe --input, --output e --fabric-id.');
  }
  await processKarvFabric({
    inputDirectory: args.input,
    outputDirectory: args.output,
    fabricId: args.fabricId,
  });
  console.log(`Tecido processado: ${args.fabricId}`);
}

main().catch((error) => {
  console.error(`Pipeline KARV TECIDOS: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
