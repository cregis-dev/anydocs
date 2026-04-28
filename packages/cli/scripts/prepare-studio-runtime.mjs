import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(scriptDir, '..');
const webRoot = path.resolve(cliRoot, '../web');
const studioRuntimeRoot = path.join(cliRoot, 'studio-runtime');
const docsRuntimeRoot = path.join(cliRoot, 'docs-runtime');

const sharedEntries = [
  'app',
  'components',
  'lib',
  'public',
  'themes',
  'utils',
  'next.config.mjs',
  'postcss.config.mjs',
  'tailwind.config.mjs',
];

const studioCopiedEntries = [...sharedEntries];
const docsCopiedEntries = [...sharedEntries, 'scripts'];

const runtimeTsconfig = {
  compilerOptions: {
    target: 'ES2017',
    lib: ['dom', 'dom.iterable', 'esnext'],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: 'esnext',
    moduleResolution: 'bundler',
    resolveJsonModule: true,
    isolatedModules: true,
    allowImportingTsExtensions: true,
    jsx: 'react-jsx',
    incremental: true,
    plugins: [{ name: 'next' }],
    paths: {
      '@/*': ['./*'],
    },
  },
  include: [
    'next-env.d.ts',
    '**/*.ts',
    '**/*.tsx',
    '**/*.mts',
    '.next/types/**/*.ts',
    '.next/dev/types/**/*.ts',
  ],
  exclude: ['node_modules', 'examples', 'tests', 'demo'],
};

function createRuntimePackageJson(name) {
  return {
    name,
    private: true,
    type: 'module',
  };
}

async function pruneDocsRuntime(rootDir) {
  await rm(path.join(rootDir, 'app', 'studio'), { recursive: true, force: true });
  await rm(path.join(rootDir, 'app', 'api', 'local'), { recursive: true, force: true });
  await rm(path.join(rootDir, 'components', 'studio'), { recursive: true, force: true });
  await rm(path.join(rootDir, 'lib', 'studio'), { recursive: true, force: true });
  await writeFile(
    path.join(rootDir, 'app', '(home)', 'page.tsx'),
    `import { redirect } from 'next/navigation';

import { getDefaultPublishedLanguage } from '@/lib/docs/data';

export default async function Page() {
  const defaultLanguage = await getDefaultPublishedLanguage();
  redirect(\`/\${defaultLanguage}\`);
}
`,
    'utf8',
  );
  await mkdir(path.join(rootDir, 'components', 'studio', 'plugins'), { recursive: true });
  await cp(
    path.join(webRoot, 'components', 'studio', 'plugins', 'mermaid'),
    path.join(rootDir, 'components', 'studio', 'plugins', 'mermaid'),
    {
      recursive: true,
      force: true,
    },
  );
}

async function prepareRuntime(rootDir, copiedEntries, packageName, options = {}) {
  await rm(rootDir, { recursive: true, force: true });
  await mkdir(rootDir, { recursive: true });

  for (const entry of copiedEntries) {
    await cp(path.join(webRoot, entry), path.join(rootDir, entry), {
      recursive: true,
      force: true,
    });
  }

  if (options.readerOnly) {
    await pruneDocsRuntime(rootDir);
  }

  await writeFile(
    path.join(rootDir, 'next-env.d.ts'),
    '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// This file is generated for the packaged CLI runtime.\n',
    'utf8',
  );
  await writeFile(path.join(rootDir, 'tsconfig.json'), `${JSON.stringify(runtimeTsconfig, null, 2)}\n`, 'utf8');
  await writeFile(
    path.join(rootDir, 'package.json'),
    `${JSON.stringify(createRuntimePackageJson(packageName), null, 2)}\n`,
    'utf8',
  );
}

async function main() {
  await prepareRuntime(studioRuntimeRoot, studioCopiedEntries, '@anydocs/cli-studio-runtime');
  await prepareRuntime(docsRuntimeRoot, docsCopiedEntries, '@anydocs/cli-docs-runtime', { readerOnly: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
