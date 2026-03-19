#!/usr/bin/env node

import { EXIT_CODE_FAILURE, EXIT_CODE_SUCCESS } from './output/exit-codes.ts';
import {
  getCliVersion,
  printCommandHelp,
  printGeneralHelp,
} from './help.ts';
import { error, info } from './output/logger.ts';
import { writeJsonError, writeJsonSuccess } from './output/structured.ts';
import { runBuildCommand } from './commands/build-command.ts';
import {
  parseGlobalCommandArgs,
  parseCreateProjectCommandArgs,
  parseConvertImportCommandArgs,
  parseImportCommandArgs,
  parseNavigationGetCommandArgs,
  parsePageFindCommandArgs,
  parsePageGetCommandArgs,
  parsePageListCommandArgs,
  parseProjectReadCommandArgs,
  parseWorkflowCommandArgs,
} from './commands/command-args.ts';
import { runConvertImportCommand } from './commands/convert-import-command.ts';
import { runImportCommand } from './commands/import-command.ts';
import { runInitCommand } from './commands/init-command.ts';
import {
  runPageFindCommand,
  runPageGetCommand,
  runPageListCommand,
} from './commands/page-command.ts';
import {
  runProjectInspectCommand,
  runProjectPathsCommand,
  runProjectValidateCommand,
} from './commands/project-command.ts';
import { runPreviewCommand } from './commands/preview-command.ts';
import { runNavigationGetCommand } from './commands/nav-command.ts';
import { runWorkflowInspectCommand } from './commands/workflow-command.ts';

const args = process.argv.slice(2);
const command = args[0];
const parsedCommandArgs = parseGlobalCommandArgs(args.slice(1));

function resolveHelpTarget(commandName: string, commandArgs: string[]): string {
  const subcommand = commandArgs.find((arg) => !arg.startsWith('-'));
  if ((commandName === 'project' || commandName === 'page' || commandName === 'nav' || commandName === 'workflow') && subcommand) {
    return `${commandName} ${subcommand}`;
  }

  return commandName;
}

async function main() {
  if (!command) {
    printGeneralHelp();
    return EXIT_CODE_SUCCESS;
  }

  if (command === '--help' || command === '-h') {
    printGeneralHelp();
    return EXIT_CODE_SUCCESS;
  }

  if (command === '--version' || command === '-v' || command === 'version') {
    if (parsedCommandArgs.json) {
      writeJsonSuccess('version', { version: getCliVersion() });
    } else {
      info(getCliVersion());
    }
    return EXIT_CODE_SUCCESS;
  }

  if (command === 'help') {
    const helpTarget = parsedCommandArgs.args.join(' ');
    if (!helpTarget) {
      printGeneralHelp();
      return EXIT_CODE_SUCCESS;
    }

    if (!printCommandHelp(helpTarget)) {
      error(`Unknown command "${helpTarget}".`);
      return EXIT_CODE_FAILURE;
    }

    return EXIT_CODE_SUCCESS;
  }

  const { args: commandArgs, json } = parsedCommandArgs;

  if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
    if (!printCommandHelp(resolveHelpTarget(command, commandArgs))) {
      error(`Unknown command "${command}".`);
      return EXIT_CODE_FAILURE;
    }

    return EXIT_CODE_SUCCESS;
  }

  switch (command) {
    case 'build': {
      return runCommand(
        () => runBuildCommand({ ...parseWorkflowCommandArgs(commandArgs), json }),
        'build',
        json,
      );
    }
    case 'preview': {
      return runCommand(
        () => runPreviewCommand({ ...parseWorkflowCommandArgs(commandArgs), json }),
        'preview',
        json,
      );
    }
    case 'init': {
      return runCommand(
        () => runInitCommand({ ...parseCreateProjectCommandArgs(commandArgs), json }),
        'init',
        json,
      );
    }
    case 'project': {
      return runResourceCommand('project', commandArgs, json);
    }
    case 'workflow': {
      return runResourceCommand('workflow', commandArgs, json);
    }
    case 'page': {
      return runResourceCommand('page', commandArgs, json);
    }
    case 'nav': {
      return runResourceCommand('nav', commandArgs, json);
    }
    case 'import': {
      return runCommand(
        () => runImportCommand({ ...parseImportCommandArgs(commandArgs), json }),
        'import',
        json,
      );
    }
    case 'convert-import': {
      return runCommand(
        () => runConvertImportCommand({ ...parseConvertImportCommandArgs(commandArgs), json }),
        'convert-import',
        json,
      );
    }
    default:
      if (json) {
        writeJsonError(command, new Error(`Unknown command "${command}".`));
      } else {
        error(`Unknown command "${command}".`);
        error('Run "pnpm --filter @anydocs/cli cli help" for usage.');
      }
      return EXIT_CODE_FAILURE;
  }
}

async function runResourceCommand(
  commandName: 'project' | 'workflow' | 'page' | 'nav',
  commandArgs: string[],
  json: boolean,
): Promise<number> {
  const subcommand = commandArgs[0];
  const subcommandArgs = commandArgs.slice(1);

  switch (commandName) {
    case 'project':
      switch (subcommand) {
        case 'create':
          return runCommand(
            () => runInitCommand({ ...parseCreateProjectCommandArgs(subcommandArgs), json }),
            'project create',
            json,
          );
        case 'inspect':
          return runCommand(
            () => runProjectInspectCommand({ ...parseProjectReadCommandArgs(subcommandArgs), json }),
            'project inspect',
            json,
          );
        case 'validate':
          return runCommand(
            () => runProjectValidateCommand({ ...parseProjectReadCommandArgs(subcommandArgs), json }),
            'project validate',
            json,
          );
        case 'paths':
          return runCommand(
            () => runProjectPathsCommand({ ...parseProjectReadCommandArgs(subcommandArgs), json }),
            'project paths',
            json,
          );
        default:
          return failUnknownSubcommand(commandName, subcommand, json);
      }
    case 'workflow':
      switch (subcommand) {
        case 'inspect':
          return runCommand(
            () => runWorkflowInspectCommand({ ...parseProjectReadCommandArgs(subcommandArgs), json }),
            'workflow inspect',
            json,
          );
        default:
          return failUnknownSubcommand(commandName, subcommand, json);
      }
    case 'page':
      switch (subcommand) {
        case 'list':
          return runCommand(
            () => runPageListCommand({ ...parsePageListCommandArgs(subcommandArgs), json }),
            'page list',
            json,
          );
        case 'get':
          return runCommand(
            () => runPageGetCommand({ ...parsePageGetCommandArgs(subcommandArgs), json }),
            'page get',
            json,
          );
        case 'find':
          return runCommand(
            () => runPageFindCommand({ ...parsePageFindCommandArgs(subcommandArgs), json }),
            'page find',
            json,
          );
        default:
          return failUnknownSubcommand(commandName, subcommand, json);
      }
    case 'nav':
      switch (subcommand) {
        case 'get':
          return runCommand(
            () => runNavigationGetCommand({ ...parseNavigationGetCommandArgs(subcommandArgs), json }),
            'nav get',
            json,
          );
        default:
          return failUnknownSubcommand(commandName, subcommand, json);
      }
  }
}

function failUnknownSubcommand(
  commandName: 'project' | 'workflow' | 'page' | 'nav',
  subcommand: string | undefined,
  json: boolean,
): number {
  const message = subcommand
    ? `Unknown ${commandName} subcommand "${subcommand}".`
    : `Missing ${commandName} subcommand.`;

  if (json) {
    writeJsonError(commandName, new Error(message));
  } else {
    error(message);
    printCommandHelp(commandName);
  }

  return EXIT_CODE_FAILURE;
}

async function runCommand(
  run: () => Promise<number>,
  helpCommand: string,
  json: boolean,
): Promise<number> {
  try {
    return await run();
  } catch (caughtError: unknown) {
    if (json) {
      writeJsonError(helpCommand, caughtError);
      return EXIT_CODE_FAILURE;
    }

    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    error(message);
    printCommandHelp(helpCommand);
    return EXIT_CODE_FAILURE;
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((caughtError) => {
    const { json } = parseGlobalCommandArgs(args.slice(1));
    if (json) {
      writeJsonError(command ?? 'anydocs', caughtError);
    } else {
      error(caughtError instanceof Error ? caughtError.message : String(caughtError));
    }
    process.exitCode = EXIT_CODE_FAILURE;
  });
