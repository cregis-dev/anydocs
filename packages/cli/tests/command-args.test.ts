import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseCreateProjectCommandArgs,
  parseGlobalCommandArgs,
  parseConvertImportCommandArgs,
  parseImportCommandArgs,
  parseNavigationGetCommandArgs,
  parseOptionalTargetDirCommandArgs,
  parsePageFindCommandArgs,
  parsePageGetCommandArgs,
  parsePageListCommandArgs,
  parseProjectReadCommandArgs,
  parseWorkflowCommandArgs,
} from '../src/commands/command-args.ts';

test('parseGlobalCommandArgs strips the --json flag', () => {
  assert.deepEqual(parseGlobalCommandArgs(['foo', '--json', 'bar']), {
    args: ['foo', 'bar'],
    json: true,
  });
});

test('parseWorkflowCommandArgs accepts one-shot workflow arguments', () => {
  assert.deepEqual(parseWorkflowCommandArgs([]), {
    targetDir: undefined,
    watch: false,
    output: undefined,
  });

  assert.deepEqual(parseWorkflowCommandArgs(['fixtures/docs']), {
    targetDir: 'fixtures/docs',
    watch: false,
    output: undefined,
  });
});

test('parseWorkflowCommandArgs accepts watch mode with or without target dir', () => {
  assert.deepEqual(parseWorkflowCommandArgs(['--watch']), {
    targetDir: undefined,
    watch: true,
    output: undefined,
  });

  assert.deepEqual(parseWorkflowCommandArgs(['fixtures/docs', '--watch']), {
    targetDir: 'fixtures/docs',
    watch: true,
    output: undefined,
  });
});

test('parseWorkflowCommandArgs rejects unsupported options and extra positionals', () => {
  assert.throws(() => parseWorkflowCommandArgs(['--watch-path']), /Unknown option/);
  assert.throws(() => parseWorkflowCommandArgs(['first', 'second']), /Too many positional arguments/);
});

test('parseOptionalTargetDirCommandArgs accepts zero or one positional argument', () => {
  assert.deepEqual(parseOptionalTargetDirCommandArgs([]), { targetDir: undefined });
  assert.deepEqual(parseOptionalTargetDirCommandArgs(['fixtures/docs']), { targetDir: 'fixtures/docs' });
  assert.throws(() => parseOptionalTargetDirCommandArgs(['first', 'second']), /Too many positional arguments/);
});

test('parseCreateProjectCommandArgs accepts positional and named init arguments', () => {
  assert.deepEqual(
    parseCreateProjectCommandArgs([
      'fixtures/docs',
      '--project-id',
      'acme-docs',
      '--name',
      'Acme Docs',
      '--default-language',
      'en',
      '--languages',
      'en,zh',
      '--agent',
      'codex',
    ]),
    {
      targetDir: 'fixtures/docs',
      projectId: 'acme-docs',
      projectName: 'Acme Docs',
      defaultLanguage: 'en',
      languages: ['en', 'zh'],
      agent: 'codex',
    },
  );
});

test('parseCreateProjectCommandArgs rejects unsupported agent values', () => {
  assert.throws(
    () => parseCreateProjectCommandArgs(['fixtures/docs', '--agent', 'unknown-agent']),
    /Unknown agent/,
  );
});

test('parseImportCommandArgs accepts positional and named arguments', () => {
  assert.deepEqual(parseImportCommandArgs(['legacy-source']), {
    sourceDir: 'legacy-source',
    targetDir: undefined,
    lang: undefined,
    convert: false,
  });

  assert.deepEqual(parseImportCommandArgs(['--source', 'legacy-source', '--target', 'project-root', '--lang', 'zh']), {
    sourceDir: 'legacy-source',
    targetDir: 'project-root',
    lang: 'zh',
    convert: false,
  });

  assert.deepEqual(parseImportCommandArgs(['--target', 'project-root', 'legacy-source']), {
    sourceDir: 'legacy-source',
    targetDir: 'project-root',
    lang: undefined,
    convert: false,
  });

  assert.deepEqual(parseImportCommandArgs(['legacy-source', 'project-root', 'en', '--convert']), {
    sourceDir: 'legacy-source',
    targetDir: 'project-root',
    lang: 'en',
    convert: true,
  });
});

test('parseImportCommandArgs rejects unknown options and missing option values', () => {
  assert.throws(() => parseImportCommandArgs(['--source']), /requires a value/);
  assert.throws(() => parseImportCommandArgs(['--bogus']), /Unknown option/);
  assert.throws(() => parseImportCommandArgs(['a', 'b', 'c', 'd']), /Too many positional arguments/);
});

test('parseConvertImportCommandArgs accepts positional and named arguments', () => {
  assert.deepEqual(parseConvertImportCommandArgs(['legacy-123']), {
    importId: 'legacy-123',
    targetDir: undefined,
  });

  assert.deepEqual(parseConvertImportCommandArgs(['--import-id', 'legacy-123', '--target', 'project-root']), {
    importId: 'legacy-123',
    targetDir: 'project-root',
  });

  assert.deepEqual(parseConvertImportCommandArgs(['project-import', 'project-root']), {
    importId: 'project-import',
    targetDir: 'project-root',
  });
});

test('parseConvertImportCommandArgs rejects invalid usage', () => {
  assert.throws(() => parseConvertImportCommandArgs(['--target']), /requires a value/);
  assert.throws(() => parseConvertImportCommandArgs(['first', 'second', 'third']), /Too many positional arguments/);
});

test('parseProjectReadCommandArgs accepts positional or named target directories', () => {
  assert.deepEqual(parseProjectReadCommandArgs([]), { targetDir: undefined });
  assert.deepEqual(parseProjectReadCommandArgs(['fixtures/docs']), { targetDir: 'fixtures/docs' });
  assert.deepEqual(parseProjectReadCommandArgs(['--target', 'fixtures/docs']), { targetDir: 'fixtures/docs' });
});

test('parsePageListCommandArgs accepts language filters and target directory', () => {
  assert.deepEqual(parsePageListCommandArgs(['fixtures/docs', '--lang', 'en', '--status', 'draft', '--tag', 'GUIDE']), {
    targetDir: 'fixtures/docs',
    lang: 'en',
    status: 'draft',
    tag: 'GUIDE',
  });
});

test('parsePageGetCommandArgs accepts positional and named arguments', () => {
  assert.deepEqual(parsePageGetCommandArgs(['welcome', 'fixtures/docs', '--lang', 'en']), {
    pageId: 'welcome',
    targetDir: 'fixtures/docs',
    lang: 'en',
  });

  assert.deepEqual(parsePageGetCommandArgs(['--page-id', 'welcome', '--target', 'fixtures/docs', '--lang', 'en']), {
    pageId: 'welcome',
    targetDir: 'fixtures/docs',
    lang: 'en',
  });
});

test('parsePageFindCommandArgs accepts slug and page filters', () => {
  assert.deepEqual(parsePageFindCommandArgs(['fixtures/docs', '--lang', 'en', '--slug', 'welcome', '--status', 'published']), {
    pageId: undefined,
    slug: 'welcome',
    targetDir: 'fixtures/docs',
    lang: 'en',
    status: 'published',
    tag: undefined,
  });
});

test('parseNavigationGetCommandArgs accepts language and target directory', () => {
  assert.deepEqual(parseNavigationGetCommandArgs(['fixtures/docs', '--lang', 'zh']), {
    targetDir: 'fixtures/docs',
    lang: 'zh',
  });
});
