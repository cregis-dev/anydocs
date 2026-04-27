import { readFileSync } from 'node:fs';

import { info } from './output/logger.ts';

export const CLI_INVOCATION = 'anydocs';

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
    '  studio [targetDir] [options]           Start the CLI Studio runtime',
    '  project <subcommand> [options]         Create or inspect project contract state',
    '  workflow inspect [targetDir]           Inspect the workflow standard definition',
    '  page <subcommand> [options]            Inspect pages by language, id, or slug',
    '  nav get [targetDir] --lang <lang>      Inspect a navigation document',
    '  import <sourceDir> [targetDir] [lang]  Stage legacy Markdown/MDX for conversion',
    '  convert-import <importId> [targetDir]  Convert imported content',
    '  help [command]                         Show general or command-specific help',
    '  version                                Print the CLI version',
    '',
    'Global options:',
    '  --json                                Print structured JSON results',
    '',
    'Examples:',
    `  ${formatCliCommand(['project', 'create', './workspace/my-docs', '--project-id', 'acme-docs'])}`,
    `  ${formatCliCommand(['init', './workspace/my-docs', '--agent', 'codex'])}`,
    `  ${formatCliCommand(['build', './workspace/my-docs'])}`,
    `  ${formatCliCommand(['build', './workspace/my-docs', '--output', './dist-public'])}`,
    `  ${formatCliCommand(['preview', './workspace/my-docs'])}`,
    `  ${formatCliCommand(['studio', './workspace/my-docs', '--no-open'])}`,
    `  ${formatCliCommand(['project', 'inspect', './workspace/my-docs', '--json'])}`,
    `  ${formatCliCommand(['page', 'get', 'welcome', './workspace/my-docs', '--lang', 'en'])}`,
    `  ${formatCliCommand(['import', './legacy-docs', './workspace/my-docs', 'zh'])}`,
    `  ${formatCliCommand(['import', './legacy-docs', './workspace/my-docs', 'zh', '--convert'])}`,
  ]);
}

export function printCommandHelp(command: string): boolean {
  switch (command) {
    case 'init':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['init', '[targetDir]', '[options]'])}`,
        '',
        'Description:',
        '  Initialize a new Anydocs project in the target directory.',
        '',
        'Options:',
        '  --project-id <id>     Custom project id',
        '  --name <name>         Custom project name',
        '  --default-language    Default language ("en" or "zh")',
        '  --languages <list>    Comma-separated enabled languages, e.g. en,zh',
        '  --agent <agent>       Generate an agent guide file ("codex" or "claude-code")',
        '  --json               Print structured JSON output',
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
        '  --json               Print structured JSON output',
      ]);
      return true;
    case 'preview':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['preview', '[targetDir]', '[options]'])}`,
        '',
        'Options:',
        '  --watch              Compatibility flag; preview already runs live',
        '  --no-open            Do not attempt to open a browser automatically',
        '  --json               Print structured JSON output',
      ]);
      return true;
    case 'studio':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['studio', '[targetDir]', '[options]'])}`,
        '',
        'Options:',
        '  --host <host>        Host interface to bind (default: 127.0.0.1)',
        '  --port <port>        Port to bind (default: auto)',
        '  --no-open            Do not attempt to open a browser automatically',
        '  --json               Print structured JSON output',
      ]);
      return true;
    case 'project':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['project', '<create|inspect|validate|paths>', '[targetDir]', '[options]'])}`,
        `  ${formatCliCommand(['project', '<create|inspect|validate|paths>', '--target', '<targetDir>', '[options]'])}`,
        '',
        'Options:',
        '  --json               Print structured JSON output',
      ]);
      return true;
    case 'project create':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['project', 'create', '[targetDir]', '[options]'])}`,
        `  ${formatCliCommand(['project', 'create', '--target', '<targetDir>', '[options]'])}`,
        '',
        'Options:',
        '  --project-id <id>     Custom project id',
        '  --name <name>         Custom project name',
        '  --default-language    Default language ("en" or "zh")',
        '  --languages <list>    Comma-separated enabled languages, e.g. en,zh',
        '  --agent <agent>       Generate an agent guide file ("codex" or "claude-code")',
        '  --json               Print structured JSON output',
      ]);
      return true;
    case 'project inspect':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['project', 'inspect', '[targetDir]', '[options]'])}`,
        `  ${formatCliCommand(['project', 'inspect', '--target', '<targetDir>', '[options]'])}`,
      ]);
      return true;
    case 'project validate':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['project', 'validate', '[targetDir]', '[options]'])}`,
        `  ${formatCliCommand(['project', 'validate', '--target', '<targetDir>', '[options]'])}`,
      ]);
      return true;
    case 'project paths':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['project', 'paths', '[targetDir]', '[options]'])}`,
        `  ${formatCliCommand(['project', 'paths', '--target', '<targetDir>', '[options]'])}`,
      ]);
      return true;
    case 'workflow':
    case 'workflow inspect':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['workflow', 'inspect', '[targetDir]', '[options]'])}`,
        `  ${formatCliCommand(['workflow', 'inspect', '--target', '<targetDir>', '[options]'])}`,
        '',
        'Options:',
        '  --json               Print structured JSON output',
      ]);
      return true;
    case 'page':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['page', '<list|get|find>', '[options]'])}`,
        '',
        'Subcommands:',
        '  list                 List pages for a language',
        '  get                  Load one page by page id',
        '  find                 Find pages by id, slug, status, or tag',
      ]);
      return true;
    case 'page list':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['page', 'list', '[targetDir]', '--lang', '<lang>', '[options]'])}`,
        `  ${formatCliCommand(['page', 'list', '--target', '<targetDir>', '--lang', '<lang>', '[options]'])}`,
        '',
        'Options:',
        '  --status <status>    Filter by page status',
        '  --tag <tag>          Filter by tag',
        '  --json               Print structured JSON output',
      ]);
      return true;
    case 'page get':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['page', 'get', '<pageId>', '[targetDir]', '--lang', '<lang>', '[options]'])}`,
        `  ${formatCliCommand(['page', 'get', '--page-id', '<pageId>', '--target', '<targetDir>', '--lang', '<lang>', '[options]'])}`,
        '',
        'Options:',
        '  --json               Print structured JSON output',
      ]);
      return true;
    case 'page find':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['page', 'find', '[targetDir]', '--lang', '<lang>', '[options]'])}`,
        `  ${formatCliCommand(['page', 'find', '--target', '<targetDir>', '--lang', '<lang>', '[options]'])}`,
        '',
        'Options:',
        '  --page-id <pageId>   Find a page by id',
        '  --slug <slug>        Find a page by slug',
        '  --status <status>    Filter by page status',
        '  --tag <tag>          Filter by tag',
        '  --json               Print structured JSON output',
      ]);
      return true;
    case 'nav':
    case 'nav get':
      printLines([
        'Usage:',
        `  ${formatCliCommand(['nav', 'get', '[targetDir]', '--lang', '<lang>', '[options]'])}`,
        `  ${formatCliCommand(['nav', 'get', '--target', '<targetDir>', '--lang', '<lang>', '[options]'])}`,
        '',
        'Options:',
        '  --json               Print structured JSON output',
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
        '  --json               Print structured JSON output',
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
        '',
        'Options:',
        '  --json               Print structured JSON output',
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
        `  ${formatCliCommand(['version', '[--json]'])}`,
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
