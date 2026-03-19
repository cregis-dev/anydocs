export type WorkflowCommandArgs = {
  targetDir?: string;
  watch: boolean;
  output?: string;
};

export type GlobalCommandArgs = {
  args: string[];
  json: boolean;
};

export type OptionalTargetDirCommandArgs = {
  targetDir?: string;
};

export type CreateProjectCommandArgs = {
  targetDir?: string;
  projectId?: string;
  projectName?: string;
  defaultLanguage?: 'en' | 'zh';
  languages?: Array<'en' | 'zh'>;
  agent?: 'codex' | 'claude-code';
};

export type ImportCommandArgs = {
  sourceDir?: string;
  targetDir?: string;
  lang?: string;
  convert: boolean;
};

export type ConvertImportCommandArgs = {
  importId?: string;
  targetDir?: string;
};

export type ProjectReadCommandArgs = {
  targetDir?: string;
};

export type PageListCommandArgs = {
  targetDir?: string;
  lang?: string;
  status?: string;
  tag?: string;
};

export type PageGetCommandArgs = {
  pageId?: string;
  targetDir?: string;
  lang?: string;
};

export type PageFindCommandArgs = {
  pageId?: string;
  slug?: string;
  targetDir?: string;
  lang?: string;
  status?: string;
  tag?: string;
};

export type NavigationGetCommandArgs = {
  targetDir?: string;
  lang?: string;
};

export function parseGlobalCommandArgs(args: string[]): GlobalCommandArgs {
  const rest: string[] = [];
  let json = false;

  for (const arg of args) {
    if (arg === '--json') {
      json = true;
      continue;
    }

    rest.push(arg);
  }

  return {
    args: rest,
    json,
  };
}

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

export function parseCreateProjectCommandArgs(args: string[]): CreateProjectCommandArgs {
  let targetDir: string | undefined;
  let projectId: string | undefined;
  let projectName: string | undefined;
  let defaultLanguage: 'en' | 'zh' | undefined;
  let languages: Array<'en' | 'zh'> | undefined;
  let agent: 'codex' | 'claude-code' | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--target') {
      targetDir = readRequiredOptionValue(args, i, arg);
      i++;
      continue;
    }

    if (arg === '--project-id') {
      projectId = readRequiredOptionValue(args, i, arg);
      i++;
      continue;
    }

    if (arg === '--name') {
      projectName = readRequiredOptionValue(args, i, arg);
      i++;
      continue;
    }

    if (arg === '--default-language') {
      defaultLanguage = readRequiredOptionValue(args, i, arg) as 'en' | 'zh';
      i++;
      continue;
    }

    if (arg === '--languages') {
      const value = readRequiredOptionValue(args, i, arg);
      languages = value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0) as Array<'en' | 'zh'>;
      i++;
      continue;
    }

    if (arg === '--agent') {
      const value = readRequiredOptionValue(args, i, arg);
      if (value !== 'codex' && value !== 'claude-code') {
        throw new Error(`Unknown agent "${value}". Use "codex" or "claude-code".`);
      }
      agent = value;
      i++;
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

  return {
    targetDir,
    projectId,
    projectName,
    defaultLanguage,
    languages,
    agent,
  };
}

export function parseImportCommandArgs(args: string[]): ImportCommandArgs {
  const positional: string[] = [];
  let sourceDir: string | undefined;
  let targetDir: string | undefined;
  let lang: string | undefined;
  let convert = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--convert') {
      convert = true;
      continue;
    }

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

  return { sourceDir, targetDir, lang, convert };
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

export function parseProjectReadCommandArgs(args: string[]): ProjectReadCommandArgs {
  let targetDir: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--target') {
      targetDir = readRequiredOptionValue(args, i, arg);
      i++;
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

  return { targetDir };
}

export function parsePageListCommandArgs(args: string[]): PageListCommandArgs {
  let targetDir: string | undefined;
  let lang: string | undefined;
  let status: string | undefined;
  let tag: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

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

    if (arg === '--status') {
      status = readRequiredOptionValue(args, i, arg);
      i++;
      continue;
    }

    if (arg === '--tag') {
      tag = readRequiredOptionValue(args, i, arg);
      i++;
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

  return { targetDir, lang, status, tag };
}

export function parsePageGetCommandArgs(args: string[]): PageGetCommandArgs {
  const positional: string[] = [];
  let pageId: string | undefined;
  let targetDir: string | undefined;
  let lang: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--page-id') {
      pageId = readRequiredOptionValue(args, i, arg);
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
    if (pageId === undefined) {
      pageId = arg;
      continue;
    }

    if (targetDir === undefined) {
      targetDir = arg;
      continue;
    }

    throw new Error('Too many positional arguments provided.');
  }

  return { pageId, targetDir, lang };
}

export function parsePageFindCommandArgs(args: string[]): PageFindCommandArgs {
  let pageId: string | undefined;
  let slug: string | undefined;
  let targetDir: string | undefined;
  let lang: string | undefined;
  let status: string | undefined;
  let tag: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--page-id') {
      pageId = readRequiredOptionValue(args, i, arg);
      i++;
      continue;
    }

    if (arg === '--slug') {
      slug = readRequiredOptionValue(args, i, arg);
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

    if (arg === '--status') {
      status = readRequiredOptionValue(args, i, arg);
      i++;
      continue;
    }

    if (arg === '--tag') {
      tag = readRequiredOptionValue(args, i, arg);
      i++;
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

  return { pageId, slug, targetDir, lang, status, tag };
}

export function parseNavigationGetCommandArgs(args: string[]): NavigationGetCommandArgs {
  let targetDir: string | undefined;
  let lang: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

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

    if (targetDir !== undefined) {
      throw new Error('Too many positional arguments provided.');
    }

    targetDir = arg;
  }

  return { targetDir, lang };
}

function readRequiredOptionValue(args: string[], index: number, optionName: string): string {
  const nextArg = args[index + 1];
  if (!nextArg || nextArg.startsWith('-')) {
    throw new Error(`Option "${optionName}" requires a value.`);
  }

  return nextArg;
}
