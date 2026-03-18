export type WorkflowCommandArgs = {
  targetDir?: string;
  watch: boolean;
  output?: string;
};

export type OptionalTargetDirCommandArgs = {
  targetDir?: string;
};

export type ImportCommandArgs = {
  sourceDir?: string;
  targetDir?: string;
  lang?: string;
};

export type ConvertImportCommandArgs = {
  importId?: string;
  targetDir?: string;
};

export function parseWorkflowCommandArgs(args: string[]): WorkflowCommandArgs {
  let targetDir: string | undefined;
  let watch = false;
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--watch') {
      watch = true;
      continue;
    }

    if (arg === '--output' || arg === '-o') {
      const nextArg = args[i + 1];
      if (!nextArg || nextArg.startsWith('-')) {
        throw new Error(`Option "${arg}" requires a value.`);
      }
      output = nextArg;
      i++; // Skip next arg since we consumed it
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option "${arg}".`);
    }

    if (targetDir !== undefined) {
      throw new Error('Too many positional arguments provided.');
    }

    targetDir = arg;
  }

  return { targetDir, watch, output };
}

export function parseOptionalTargetDirCommandArgs(args: string[]): OptionalTargetDirCommandArgs {
  if (args.length === 0) {
    return { targetDir: undefined };
  }

  if (args.length > 1) {
    throw new Error('Too many positional arguments provided.');
  }

  const [targetDir] = args;
  if (targetDir.startsWith('-')) {
    throw new Error(`Unknown option "${targetDir}".`);
  }

  return { targetDir };
}

export function parseImportCommandArgs(args: string[]): ImportCommandArgs {
  const positional: string[] = [];
  let sourceDir: string | undefined;
  let targetDir: string | undefined;
  let lang: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--source') {
      sourceDir = readRequiredOptionValue(args, i, arg);
      i++;
      continue;
    }

    if (arg === '--target') {
      targetDir = readRequiredOptionValue(args, i, arg);
      i++;
      continue;
    }

    if (arg === '--lang') {
      lang = readRequiredOptionValue(args, i, arg);
      i++;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option "${arg}".`);
    }

    positional.push(arg);
  }

  for (const arg of positional) {
    if (sourceDir === undefined) {
      sourceDir = arg;
      continue;
    }

    if (targetDir === undefined) {
      targetDir = arg;
      continue;
    }

    if (lang === undefined) {
      lang = arg;
      continue;
    }

    throw new Error('Too many positional arguments provided.');
  }

  return { sourceDir, targetDir, lang };
}

export function parseConvertImportCommandArgs(args: string[]): ConvertImportCommandArgs {
  const positional: string[] = [];
  let importId: string | undefined;
  let targetDir: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--target') {
      targetDir = readRequiredOptionValue(args, i, arg);
      i++;
      continue;
    }

    if (arg === '--import-id') {
      importId = readRequiredOptionValue(args, i, arg);
      i++;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option "${arg}".`);
    }

    positional.push(arg);
  }

  for (const arg of positional) {
    if (importId === undefined) {
      importId = arg;
      continue;
    }

    if (targetDir === undefined) {
      targetDir = arg;
      continue;
    }

    throw new Error('Too many positional arguments provided.');
  }

  return { importId, targetDir };
}

function readRequiredOptionValue(args: string[], index: number, optionName: string): string {
  const nextArg = args[index + 1];
  if (!nextArg || nextArg.startsWith('-')) {
    throw new Error(`Option "${optionName}" requires a value.`);
  }

  return nextArg;
}
