import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(webRoot, '../..');
const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const tsconfigPath = path.join(webRoot, 'tsconfig.json');
const RUNTIME_ENV_ALLOWLIST = new Set([
  'CI',
  'COLORTERM',
  'FORCE_COLOR',
  'HOME',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'LOGNAME',
  'PATH',
  'PNPM_HOME',
  'SHELL',
  'TERM',
  'TMPDIR',
  'USER',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
]);

function getMode() {
  const mode = process.argv[2] ?? 'public';
  if (mode === 'export' || mode === 'preview' || mode === 'public' || mode === 'desktop') {
    return mode;
  }

  throw new Error(`Unsupported docs runtime bridge mode "${mode}".`);
}

function getProjectRoot() {
  return process.env.ANYDOCS_DOCS_PROJECT_ROOT || repoRoot;
}

function getOutputRoot(mode) {
  if (mode === 'desktop') {
    return process.env.ANYDOCS_DOCS_OUTPUT_ROOT || path.join(webRoot, 'out');
  }

  return process.env.ANYDOCS_DOCS_OUTPUT_ROOT || path.join(repoRoot, 'dist');
}

function createRuntimeEnv(mode, overrides = {}) {
  const projectRoot = getProjectRoot();
  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => RUNTIME_ENV_ALLOWLIST.has(key)),
  );

  return {
    ...baseEnv,
    NODE_ENV: mode === 'export' || mode === 'public' || mode === 'desktop' ? 'production' : 'development',
    ...(mode === 'desktop'
      ? {
          ANYDOCS_DESKTOP_RUNTIME: '1',
        }
      : {
          ANYDOCS_DOCS_RUNTIME: mode === 'public' ? 'export' : mode,
          ANYDOCS_DOCS_PROJECT_ROOT: projectRoot,
          ANYDOCS_DISABLE_STUDIO: '1',
        }),
    ...overrides,
  };
}

function runNext(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, ...args], {
      cwd: webRoot,
      stdio: options.stdio ?? 'inherit',
      env: options.env ?? process.env,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`next ${args[0]} failed (exit=${code ?? 'null'}, signal=${signal ?? 'null'}).`));
    });
  });
}

async function snapshotTsconfig() {
  return readFile(tsconfigPath, 'utf8');
}

function normalizeGeneratedTypeIncludes(include = [], distDir) {
  const baseIncludes = include.filter(
    (entry) => typeof entry === 'string' && !/^\.next($|[-/])/.test(entry),
  );

  return [
    ...baseIncludes,
    `${distDir}/types/**/*.ts`,
    `${distDir}/dev/types/**/*.ts`,
  ];
}

async function prepareTsconfigForDist(originalContent, distDir) {
  const parsed = JSON.parse(originalContent);
  const nextConfig = {
    ...parsed,
    include: normalizeGeneratedTypeIncludes(Array.isArray(parsed.include) ? parsed.include : [], distDir),
  };

  await writeFile(tsconfigPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
}

async function restoreTsconfig(originalContent) {
  const currentContent = await readFile(tsconfigPath, 'utf8').catch(() => null);
  if (currentContent !== null && currentContent !== originalContent) {
    await writeFile(tsconfigPath, originalContent, 'utf8');
  }
}

async function cleanupExportOutput(outputRoot) {
  await mkdir(outputRoot, { recursive: true });
  const entries = await readdir(outputRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (
      entry.name === 'mcp' ||
      entry.name === 'llms.txt' ||
      entry.name === 'build-manifest.json' ||
      /^search-index\..+\.json$/.test(entry.name)
    ) {
      continue;
    }

    await rm(path.join(outputRoot, entry.name), { recursive: true, force: true });
  }
}

async function pruneNonDocsSiteArtifacts(outputRoot, mode) {
  const removableEntries = mode === 'desktop' ? ['admin', 'projects'] : ['admin', 'projects', 'studio'];
  for (const entryName of removableEntries) {
    await rm(path.join(outputRoot, entryName), { recursive: true, force: true });
  }
}

async function pruneInternalExportArtifacts(outputRoot) {
  const preservedTextFiles = new Set(['llms.txt', 'robots.txt']);
  const shouldPreserveTxt = (name) => preservedTextFiles.has(name) || name.startsWith('__next.');
  const entries = await readdir(outputRoot, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(outputRoot, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '_not-found') {
        await rm(entryPath, { recursive: true, force: true });
        continue;
      }

      await pruneInternalExportArtifacts(entryPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.txt') && !shouldPreserveTxt(entry.name)) {
      await rm(entryPath, { force: true });
    }
  }
}

async function exportDocsSite(mode) {
  const outputRoot = getOutputRoot(mode);
  const distDir = '.next-cli-export';
  const exportDir = path.join(webRoot, 'out');
  const originalTsconfig = await snapshotTsconfig();
  const hiddenEntries = [
    {
      source: path.join(webRoot, 'app', 'api'),
      backup: path.join(webRoot, 'app', '__api_export_hidden__'),
    },
    {
      source: path.join(webRoot, 'app', 'studio'),
      backup: path.join(webRoot, 'app', '__studio_export_hidden__'),
    },
    ...(mode === 'desktop'
      ? [
          {
            source: path.join(webRoot, 'app', 'docs'),
            backup: path.join(webRoot, 'app', '__docs_export_hidden__'),
          },
          {
            source: path.join(webRoot, 'app', '[lang]'),
            backup: path.join(webRoot, 'app', '__lang_export_hidden__'),
          },
        ]
      : []),
  ];

  await rm(exportDir, { recursive: true, force: true });
  await rm(path.join(webRoot, distDir), { recursive: true, force: true });
  for (const entry of hiddenEntries) {
    await rm(entry.backup, { recursive: true, force: true });
  }

  for (const entry of hiddenEntries) {
    try {
      await rename(entry.source, entry.backup);
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  const distDirFull = path.join(webRoot, distDir);

  try {
    await prepareTsconfigForDist(originalTsconfig, distDir);

    await runNext(['build'], {
      env: createRuntimeEnv(mode, {
        ANYDOCS_NEXT_DIST_DIR: distDir,
        ANYDOCS_DOCS_OUTPUT_ROOT: outputRoot,
      }),
    });

    await cleanupExportOutput(outputRoot);

    // Next.js static export defaults to 'out', but might fallback to distDir structure
    // if export is skipped or config is not picked up.
    let finalExportSource = exportDir;
    const outExists = await readdir(webRoot).then(files => files.includes('out')).catch(() => false);
    if (!outExists) {
      finalExportSource = distDirFull;
    }

    await cp(finalExportSource, outputRoot, { recursive: true, force: true });
    await pruneNonDocsSiteArtifacts(outputRoot, mode);
    await pruneInternalExportArtifacts(outputRoot);
  } finally {
    for (const entry of hiddenEntries) {
      try {
        await rename(entry.backup, entry.source);
      } catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    await restoreTsconfig(originalTsconfig);
  }
}

async function runPreviewProxy() {
  const args = process.argv.slice(3);
  const distDir = '.next-cli-preview';
  const originalTsconfig = await snapshotTsconfig();
  await prepareTsconfigForDist(originalTsconfig, distDir);
  await rm(path.join(webRoot, distDir), { recursive: true, force: true });
  let shuttingDown = false;
  const child = spawn(process.execPath, [nextBin, 'dev', ...args], {
    cwd: webRoot,
    stdio: 'inherit',
    env: createRuntimeEnv('preview', {
      ANYDOCS_NEXT_DIST_DIR: distDir,
    }),
  });

  const forwardSignal = (signal) => {
    shuttingDown = true;
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  child.on('exit', (code, signal) => {
    process.off('SIGINT', forwardSignal);
    process.off('SIGTERM', forwardSignal);
    restoreTsconfig(originalTsconfig)
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        process.exit(code ?? (shuttingDown ? 0 : signal ? 1 : 0));
      });
  });

  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
}

async function main() {
  const mode = getMode();

  if (mode === 'preview') {
    await runPreviewProxy();
    return;
  }

  await exportDocsSite(mode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
