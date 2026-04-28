import { chmod, copyFile, cp, lstat, mkdir, readFile, readlink, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const desktopRoot = path.join(repoRoot, 'packages', 'desktop');
const resourcesRoot = path.join(desktopRoot, 'resources');
const runtimeRoot = path.join(resourcesRoot, 'node-runtime');
const cliRoot = path.join(repoRoot, 'packages', 'cli');
const cliRuntimeRoot = path.join(resourcesRoot, 'cli-runtime');
const repoNodeModulesRoot = path.join(repoRoot, 'node_modules');
const repoPnpmRoot = path.join(repoNodeModulesRoot, '.pnpm');
const cliNodeModulesRoot = path.join(cliRoot, 'node_modules');
const cliRuntimeNodeModulesRoot = path.join(cliRuntimeRoot, 'node_modules');
const cliRuntimePnpmRoot = path.join(cliRuntimeNodeModulesRoot, '.pnpm');
const cliRuntimeSymlinkManifestPath = path.join(cliRuntimeNodeModulesRoot, '.anydocs-symlinks.json');
const copiedPnpmEntries = new Set();
const rustOsByNodePlatform = {
  darwin: 'macos',
  linux: 'linux',
  win32: 'windows',
};
const rustArchByNodeArch = {
  arm64: 'aarch64',
  x64: 'x86_64',
};
const platformKey = `${rustOsByNodePlatform[process.platform] ?? process.platform}-${rustArchByNodeArch[process.arch] ?? process.arch}`;
const nodeFileName = process.platform === 'win32' ? 'node.exe' : 'node';
const targetDir = path.join(runtimeRoot, platformKey);
const targetPath = path.join(targetDir, nodeFileName);
const desktopRuntimePackages = new Set([
  '@anydocs/core',
  '@radix-ui/react-dialog',
  '@radix-ui/react-select',
  '@radix-ui/react-slot',
  '@tailwindcss/postcss',
  '@types/node',
  '@types/react',
  'class-variance-authority',
  'clsx',
  'lucide-react',
  'minisearch',
  'next',
  'react',
  'react-dom',
  'react-markdown',
  'remark-gfm',
  'tailwind-merge',
  'tailwindcss',
  'typescript',
]);

async function pathExists(filePath) {
  try {
    await lstat(filePath);
    return true;
  } catch {
    return false;
  }
}

function isInsidePath(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolvePnpmPackage(realPath) {
  const resolved = await realpath(realPath);
  if (!isInsidePath(resolved, repoPnpmRoot)) {
    return null;
  }

  const relative = path.relative(repoPnpmRoot, resolved);
  const [entryName, ...insideEntryParts] = relative.split(path.sep);
  if (!entryName || insideEntryParts.length === 0) {
    return null;
  }

  return {
    entryName,
    packagePath: insideEntryParts.join(path.sep),
  };
}

async function copyPnpmEntry(entryName) {
  if (copiedPnpmEntries.has(entryName)) {
    return;
  }

  copiedPnpmEntries.add(entryName);
  const sourceEntry = path.join(repoPnpmRoot, entryName);
  const targetEntry = path.join(cliRuntimePnpmRoot, entryName);
  await cp(sourceEntry, targetEntry, {
    recursive: true,
    force: true,
    dereference: false,
  });

  await copyLinkedPnpmDependencies(sourceEntry);
}

async function copyLinkedPnpmDependencies(sourceDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    if (entry.isSymbolicLink()) {
      const resolved = await resolvePnpmPackage(sourcePath);
      if (resolved) {
        await copyPnpmEntry(resolved.entryName);
      }
      continue;
    }

    if (entry.isDirectory()) {
      await copyLinkedPnpmDependencies(sourcePath);
    }
  }
}

async function createRuntimePackageLink(sourcePath, targetPath) {
  const resolved = await resolvePnpmPackage(sourcePath);
  if (!resolved) {
    await cp(sourcePath, targetPath, {
      recursive: true,
      force: true,
      dereference: true,
    });
    return;
  }

  await copyPnpmEntry(resolved.entryName);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await rm(targetPath, { recursive: true, force: true });
  const runtimeTarget = path.join(cliRuntimePnpmRoot, resolved.entryName, resolved.packagePath);
  const relativeTarget = path.relative(path.dirname(targetPath), runtimeTarget);
  await symlink(relativeTarget, targetPath, 'dir');
}

async function copyCliNodeModules() {
  await mkdir(cliRuntimePnpmRoot, { recursive: true });

  for (const packageName of [...desktopRuntimePackages].sort()) {
    const packagePathParts = packageName.split('/');
    const sourcePath = path.join(cliNodeModulesRoot, ...packagePathParts);
    const targetPath = path.join(cliRuntimeNodeModulesRoot, ...packagePathParts);

    if (!(await pathExists(sourcePath))) {
      throw new Error(`Desktop runtime dependency "${packageName}" is not installed at ${sourcePath}`);
    }

    await createRuntimePackageLink(sourcePath, targetPath);
  }
}

async function collectSymlinks(root, dir = root, symlinks = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    const relativePath = path.relative(root, entryPath);

    if (entry.isSymbolicLink()) {
      symlinks.push({
        path: relativePath,
        target: await readlink(entryPath),
      });
      continue;
    }

    if (entry.isDirectory()) {
      await collectSymlinks(root, entryPath, symlinks);
    }
  }

  return symlinks;
}

async function writeSymlinkManifest() {
  if (!(await pathExists(cliRuntimeNodeModulesRoot))) {
    return;
  }

  const symlinks = await collectSymlinks(cliRuntimeNodeModulesRoot);
  await writeFile(cliRuntimeSymlinkManifestPath, `${JSON.stringify({ version: 1, symlinks }, null, 2)}\n`);
}

async function pruneDesktopDocsRuntime() {
  await rm(path.join(cliRuntimeRoot, 'docs-runtime', 'components', 'docs', 'legacy-yoopta-doc-view.tsx'), {
    force: true,
  });
  await rm(path.join(cliRuntimeRoot, 'docs-runtime', 'lib', 'docs', 'legacy-yoopta-reader.ts'), {
    force: true,
  });
  await rm(path.join(cliRuntimeRoot, 'docs-runtime', 'components', 'studio', 'plugins', 'mermaid', 'plugin.tsx'), {
    force: true,
  });
  await rm(path.join(cliRuntimeRoot, 'docs-runtime', 'components', 'studio', 'plugins', 'mermaid', 'index.ts'), {
    force: true,
  });

  const globalsPath = path.join(cliRuntimeRoot, 'docs-runtime', 'app', 'globals.css');
  const globals = await readFile(globalsPath, 'utf8');
  await writeFile(
    globalsPath,
    globals.replace(/^@import "@yoopta\/themes-shadcn\/variables\.css";\n/m, ''),
    'utf8',
  );
}

async function writeDesktopScalarFallback() {
  const scalarComponentPath = path.join(cliRuntimeRoot, 'docs-runtime', 'components', 'docs', 'scalar-api-reference.tsx');
  await writeFile(
    scalarComponentPath,
    `'use client';

function formatSpecContent(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return 'Unable to render OpenAPI content.';
  }
}

export function ScalarApiReference({
  specContent,
  title,
  description,
  sourceId,
}: {
  specContent: unknown;
  showTryIt: boolean;
  title?: string;
  description?: string;
  sourceId?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-fd-border bg-white shadow-sm">
      <div className="border-b border-fd-border px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fd-muted-foreground">
          API Reference
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-fd-foreground">
          {title ?? 'OpenAPI Reference'}
        </h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-fd-muted-foreground">{description}</p> : null}
        {sourceId ? <p className="mt-3 text-xs font-medium text-fd-muted-foreground">{sourceId}</p> : null}
      </div>
      <pre className="max-h-[70vh] overflow-auto p-6 text-xs leading-5 text-fd-foreground">
        <code>{formatSpecContent(specContent)}</code>
      </pre>
    </div>
  );
}
`,
    'utf8',
  );
}

async function writeDesktopMermaidFallback() {
  const mermaidViewerPath = path.join(
    cliRuntimeRoot,
    'docs-runtime',
    'components',
    'studio',
    'plugins',
    'mermaid',
    'mermaid-viewer.tsx',
  );
  await writeFile(
    mermaidViewerPath,
    `'use client';

export function MermaidViewer({ code }: { code: string }) {
  return (
    <div className="my-6 rounded-lg border border-fd-border bg-fd-muted/40">
      <div className="border-b border-fd-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-fd-muted-foreground">
        Mermaid diagram
      </div>
      <pre className="max-h-[420px] overflow-auto p-4 text-xs leading-5 text-fd-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}
`,
    'utf8',
  );
}

await rm(runtimeRoot, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });
await copyFile(process.execPath, targetPath);

if (process.platform !== 'win32') {
  await chmod(targetPath, 0o755);
}

await rm(cliRuntimeRoot, { recursive: true, force: true });
await mkdir(cliRuntimeRoot, { recursive: true });
for (const entry of ['package.json', 'dist', 'docs-runtime']) {
  await cp(path.join(cliRoot, entry), path.join(cliRuntimeRoot, entry), {
    recursive: true,
    force: true,
    dereference: false,
  });
}
await pruneDesktopDocsRuntime();
await writeDesktopScalarFallback();
await writeDesktopMermaidFallback();
if (await pathExists(cliNodeModulesRoot)) {
  await copyCliNodeModules();
}
await symlink('../node_modules', path.join(cliRuntimeRoot, 'docs-runtime', 'node_modules'), 'dir');
await writeSymlinkManifest();

console.log(`[desktop-runtime] copied ${process.execPath} -> ${targetPath}`);
console.log(`[desktop-runtime] prepared CLI runtime at ${cliRuntimeRoot}`);
