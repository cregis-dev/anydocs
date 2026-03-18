#!/usr/bin/env node

import { EXIT_CODE_FAILURE, EXIT_CODE_SUCCESS } from './output/exit-codes.ts';
import {
  getCliVersion,
  printCommandHelp,
  printGeneralHelp,
} from './help.ts';
import { error, info } from './output/logger.ts';
import { runBuildCommand } from './commands/build-command.ts';
import {
  parseConvertImportCommandArgs,
  parseImportCommandArgs,
  parseOptionalTargetDirCommandArgs,
  parseWorkflowCommandArgs,
} from './commands/command-args.ts';
import { runConvertImportCommand } from './commands/convert-import-command.ts';
import { runImportCommand } from './commands/import-command.ts';
import { runInitCommand } from './commands/init-command.ts';
import { runPreviewCommand } from './commands/preview-command.ts';

const args = process.argv.slice(2);
const command = args[0];

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
    info(getCliVersion());
    return EXIT_CODE_SUCCESS;
  }

  if (command === 'help') {
    const helpTarget = args[1];
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

  if (args.slice(1).includes('--help') || args.slice(1).includes('-h')) {
    if (!printCommandHelp(command)) {
      error(`Unknown command "${command}".`);
      return EXIT_CODE_FAILURE;
    }

    return EXIT_CODE_SUCCESS;
  }

  switch (command) {
    case 'build': {
      return runCommand(() => runBuildCommand(parseWorkflowCommandArgs(args.slice(1))), 'build');
    }
    case 'preview': {
      return runCommand(() => runPreviewCommand(parseWorkflowCommandArgs(args.slice(1))), 'preview');
    }
    case 'init': {
      return runCommand(
        () => runInitCommand(parseOptionalTargetDirCommandArgs(args.slice(1)).targetDir),
        'init',
      );
    }
    case 'import': {
      return runCommand(() => runImportCommand(parseImportCommandArgs(args.slice(1))), 'import');
    }
    case 'convert-import': {
      return runCommand(
        () => runConvertImportCommand(parseConvertImportCommandArgs(args.slice(1))),
        'convert-import',
      );
    }
    default:
      error(`Unknown command "${command}".`);
      error('Run "pnpm --filter @anydocs/cli cli help" for usage.');
      return EXIT_CODE_FAILURE;
  }
}

async function runCommand(
  run: () => Promise<number>,
  helpCommand: string,
): Promise<number> {
  try {
    return await run();
  } catch (caughtError: unknown) {
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
    error(caughtError instanceof Error ? caughtError.message : String(caughtError));
    process.exitCode = EXIT_CODE_FAILURE;
  });
