import path from 'node:path';

import { importLegacyDocumentation, ValidationError } from '@anydocs/core';

import { runConvertImportCommand } from './convert-import-command.ts';
import { formatCliCommand } from '../help.ts';
import { error, info } from '../output/logger.ts';
import { writeJsonError, writeJsonSuccess } from '../output/structured.ts';

type ImportCommandOptions = {
  sourceDir?: string;
  targetDir?: string;
  lang?: string;
  convert?: boolean;
  json?: boolean;
};

export async function runImportCommand(options: ImportCommandOptions): Promise<number> {
  if (!options.sourceDir) {
    if (options.json) {
      writeJsonError('import', new Error('Import failed: missing legacy source directory.'));
      return 1;
    }
    error('Import failed: missing legacy source directory.');
    error('Usage: anydocs import <sourceDir> [targetDir] [lang]');
    return 1;
  }

  if (options.lang && options.lang !== 'zh' && options.lang !== 'en') {
    if (options.json) {
      writeJsonError('import', new Error(`Import failed: unsupported language "${options.lang}".`));
      return 1;
    }
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

    if (options.json && !options.convert) {
      writeJsonSuccess(
        'import',
        {
          importId: result.importId,
          importRoot: result.importRoot,
          manifestFile: result.manifestFile,
          itemCount: result.itemCount,
          items: result.items,
        },
        {
          repoRoot,
        },
      );
      return 0;
    }

    if (options.json && options.convert) {
      return runConvertImportCommand({
        importId: result.importId,
        targetDir: options.targetDir,
        json: true,
      });
    }

    info(`Imported ${result.itemCount} legacy documents into staged conversion path.`);
    info(`Import ID: ${result.importId}`);
    info(`Import root: ${result.importRoot}`);
    info(`Manifest: ${result.manifestFile}`);
    for (const item of result.items) {
      info(`- ${item.lang}:${item.slug} <- ${item.sourcePath}`);
    }

    if (options.convert) {
      info('Next:');
      info(`- Converting staged import immediately because --convert was provided.`);
      return runConvertImportCommand({
        importId: result.importId,
        targetDir: options.targetDir,
        json: options.json,
      });
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
      if (options.json) {
        writeJsonError('import', caughtError, { repoRoot });
        return 1;
      }
      error(`Import failed: ${caughtError.message}`);
      error(`Rule: ${caughtError.details.rule}`);
      if (caughtError.details.remediation) {
        error(`Fix: ${caughtError.details.remediation}`);
      }
      return 1;
    }

    if (options.json) {
      writeJsonError('import', caughtError, { repoRoot });
      return 1;
    }
    error(`Import failed: ${caughtError instanceof Error ? caughtError.message : String(caughtError)}`);
    return 1;
  }
}
