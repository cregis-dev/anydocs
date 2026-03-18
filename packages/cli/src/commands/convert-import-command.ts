import path from 'node:path';

import { convertImportedLegacyContent, ValidationError } from '@anydocs/core';

import { formatCliCommand } from '../help.ts';
import { error, info } from '../output/logger.ts';

type ConvertImportCommandOptions = {
  importId?: string;
  targetDir?: string;
};

export async function runConvertImportCommand(options: ConvertImportCommandOptions): Promise<number> {
  if (!options.importId) {
    error('Convert import failed: missing import id.');
    error('Usage: anydocs convert-import <importId> [targetDir]');
    return 1;
  }

  const repoRoot = path.resolve(process.cwd(), options.targetDir ?? '.');

  try {
    const result = await convertImportedLegacyContent({
      repoRoot,
      importId: options.importId,
    });

    info(`Converted ${result.convertedCount} staged documents into canonical draft pages.`);
    info(`Import root: ${result.importRoot}`);
    info(`Report: ${result.reportFile}`);
    for (const item of result.items) {
      info(`- ${item.lang}:${item.slug} -> ${item.pageId} (${item.status})`);
      for (const warning of item.warnings) {
        info(`  warning: ${warning.code} - ${warning.message}`);
      }
    }
    info('Next:');
    info('- Review the generated draft pages and publish the ones you want to ship.');
    info(
      `- After publishing, rebuild the site: ${formatCliCommand([
        'build',
        ...(options.targetDir ? [options.targetDir] : []),
      ])}`,
    );
    return 0;
  } catch (caughtError: unknown) {
    if (caughtError instanceof ValidationError) {
      error(`Convert import failed: ${caughtError.message}`);
      error(`Rule: ${caughtError.details.rule}`);
      if (caughtError.details.remediation) {
        error(`Fix: ${caughtError.details.remediation}`);
      }
      return 1;
    }

    error(`Convert import failed: ${caughtError instanceof Error ? caughtError.message : String(caughtError)}`);
    return 1;
  }
}
