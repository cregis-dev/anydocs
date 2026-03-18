import { readFileSync } from 'node:fs';

import { info } from './output/logger.ts';

export const CLI_INVOCATION = 'pnpm --filter @anydocs/cli cli';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export function getCliVersion(): string {
  return packageJson.version;
}

export function formatCliCommand(args: string[]): string {
  const suffix = args.map(formatShellArg).join(' ');
  return suffix.length > 0 ? `${CLI_INVOCATION} ${suffix}` : CLI_INVOCATION;
}

export function printGeneralHelp(): void {
  printLines([
    'Anydocs CLI',
    '',
    'Usage:',
    `  ${CLI_INVOCATION} <command> [options]`,
    '',
    'Commands:',
    '  init [targetDir]                       Initialize a new docs project',
    '  build [targetDir] [options]            Build a deployable static docs site',
    '  preview [targetDir] [options]          Start a live local docs preview server',
    '  import <sourceDir> [targetDir] [lang]  Stage legacy Markdown/MDX for conversion',
    '  convert-import <importId> [targetDir]  Convert imported content',
    '  help [command]                         Show general or command-specific help',
    '  version                                Print the CLI version',
    '',
    'Examples:',
    `  ${formatCliCommand(['init', './workspace/my-docs'])}`,
    `  ${formatCliCommand(['build', './workspace/my-docs'])}`,
    `  ${formatCliCommand(['build', './workspace/my-docs', '--output', './dist-public'])}`,
    `  ${formatCliCommand(['preview', './workspace/my-docs'])}`,
    `  ${formatCliCommand(['import', './legacy-docs', './workspace/my-docs', 'zh'])}`,
    `  ${formatCliCommand(['import', './legacy-docs', './workspace/my-docs', 'zh', '--convert'])}`,
  ]);
}

export function printCommandHelp(command: string): boolean {
  switch (command) {
    case 'init':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['init', '[targetDir]'])}`,
        '',
        'Description:',
        '  Initialize a new Anydocs project in the target directory.',
      ]);
      return true;
    case 'build':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['build', '[targetDir]', '[options]'])}`,
        '',
        'Options:',
        '  --output, -o <dir>   Custom output directory (default: {targetDir}/dist)',
        '  --watch              Watch for changes and rebuild',
      ]);
      return true;
    case 'preview':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['preview', '[targetDir]', '[options]'])}`,
        '',
        'Options:',
        '  --watch              Compatibility flag; preview already runs live',
      ]);
      return true;
    case 'import':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['import', '<sourceDir>', '[targetDir]', '[lang]', '[options]'])}`,
        `  ${formatCliCommand(['import', '--source', '<sourceDir>', '--target', '<targetDir>', '--lang', '<lang>', '[options]'])}`,
        '',
        'Options:',
        '  --convert            Immediately convert the staged import into draft pages',
        '',
        'Notes:',
        '  lang currently supports only "zh" or "en".',
      ]);
      return true;
    case 'convert-import':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['convert-import', '<importId>', '[targetDir]'])}`,
        `  ${formatCliCommand(['convert-import', '--import-id', '<importId>', '--target', '<targetDir>'])}`,
      ]);
      return true;
    case 'help':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['help', '[command]'])}`,
      ]);
      return true;
    case 'version':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['version'])}`,
      ]);
      return true;
    default:
      return false;
  }
}

function formatShellArg(arg: string): string {
  if (/^[A-Za-z0-9_./:@=<>\-[\]]+$/.test(arg)) {
    return arg;
  }

  return JSON.stringify(arg);
}

function printLines(lines: string[]): void {
  for (const line of lines) {
    info(line);
  }
}
