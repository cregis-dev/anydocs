import path from 'node:path';

import { importLegacyDocumentation, ValidationError } from '@anydocs/core';

import { formatCliCommand } from '../help.ts';
import { error, info } from '../output/logger.ts';

type ImportCommandOptions = {
  sourceDir?: string;
  targetDir?: string;
  lang?: string;
};

export async function runImportCommand(options: ImportCommandOptions): Promise<number> {
  if (!options.sourceDir) {
    error('Import failed: missing legacy source directory.');
    error('Usage: anydocs import <sourceDir> [targetDir] [lang]');
    return 1;
  }

  if (options.lang && options.lang !== 'zh' && options.lang !== 'en') {
    error(`Import failed: unsupported language "${options.lang}".`);
    error('Fix: use "zh" or "en" when providing an explicit import language.');
    return 1;
  }

  const repoRoot = path.resolve(process.cwd(), options.targetDir ?? '.');
  const sourceRoot = path.resolve(process.cwd(), options.sourceDir);

  try {
    const result = await importLegacyDocumentation({
      repoRoot,
      sourceRoot,
      lang: options.lang as 'zh' | 'en' | undefined,
    });

    info(`Imported ${result.itemCount} legacy documents into staged conversion path.`);
    info(`Import ID: ${result.importId}`);
    info(`Import root: ${result.importRoot}`);
    info(`Manifest: ${result.manifestFile}`);
    for (const item of result.items) {
      info(`- ${item.lang}:${item.slug} <- ${item.sourcePath}`);
    }
    info('Next:');
    info(
      `- Convert the staged import: ${formatCliCommand([
        'convert-import',
        result.importId,
        ...(options.targetDir ? [options.targetDir] : []),
      ])}`,
    );
    return 0;
  } catch (caughtError: unknown) {
    if (caughtError instanceof ValidationError) {
      error(`Import failed: ${caughtError.message}`);
      error(`Rule: ${caughtError.details.rule}`);
      if (caughtError.details.remediation) {
        error(`Fix: ${caughtError.details.remediation}`);
      }
      return 1;
    }

    error(`Import failed: ${caughtError instanceof Error ? caughtError.message : String(caughtError)}`);
    return 1;
  }
}
