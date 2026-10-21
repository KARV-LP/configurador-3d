import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const playwrightCli = fileURLToPath(
  new URL('../node_modules/@playwright/test/cli.js', import.meta.url),
);
const result = spawnSync(
  process.execPath,
  [playwrightCli, 'test', 'tests/e2e/pbr-live.spec.ts', '--retries=1'],
  {
    env: { ...process.env, KARV_LIVE_LIBRARY: '1' },
    stdio: 'inherit',
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
