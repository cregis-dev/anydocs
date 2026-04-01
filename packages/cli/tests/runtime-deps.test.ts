import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI_PACKAGE_JSON = fileURLToPath(new URL('../package.json', import.meta.url));
const WEB_PACKAGE_JSON = fileURLToPath(new URL('../../web/package.json', import.meta.url));

type PackageJson = {
  dependencies?: Record<string, string>;
};

async function readPackageJson(path: string): Promise<PackageJson> {
  return JSON.parse(await readFile(path, 'utf8')) as PackageJson;
}

test('cli package ships every web runtime dependency required by packaged runtimes', async () => {
  const cliPackage = await readPackageJson(CLI_PACKAGE_JSON);
  const webPackage = await readPackageJson(WEB_PACKAGE_JSON);
  const cliDeps = cliPackage.dependencies ?? {};
  const webDeps = webPackage.dependencies ?? {};

  const missingDeps = Object.keys(webDeps).filter((dependency) => !(dependency in cliDeps));

  assert.deepEqual(
    missingDeps,
    [],
    `CLI package is missing web runtime dependencies: ${missingDeps.join(', ')}`,
  );
});
