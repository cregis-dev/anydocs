import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ANYDOCS_CONFIG_FILE,
  createDefaultProjectConfig,
} from '../config/project-config.ts';
import { ValidationError } from '../errors/validation-error.ts';
import {
  createDocsRepository,
  initializeDocsRepository,
  saveNavigation,
  savePage,
} from '../fs/docs-repository.ts';
import { validateProjectConfig } from '../schemas/project-schema.ts';
import type { NavigationDoc, PageDoc } from '../types/docs.ts';
import type { DocsLanguage, ProjectContract } from '../types/project.ts';
import { createProjectPathContract } from '../fs/project-paths.ts';
import { exportWorkflowStandard } from './workflow-standard-service.ts';

export type InitProjectOptions = {
  repoRoot: string;
  projectId?: string;
  projectName?: string;
  defaultLanguage?: DocsLanguage;
  languages?: DocsLanguage[];
  agent?: 'codex' | 'claude-code';
};

export type InitProjectResult = {
  contract: ProjectContract;
  createdFiles: string[];
};

type TemplateCopyPlan = {
  targetRelativePath: string;
  sourcePath: string;
};

const DEFAULT_INIT_LANGUAGE: DocsLanguage = 'zh';
const DEFAULT_INIT_LANGUAGES: DocsLanguage[] = ['zh', 'en'];

const PROJECT_SKILL_GUIDE_FILE = 'skill.md';
const PROJECT_AGENT_GUIDE_FILES = {
  codex: 'AGENTS.md',
  'claude-code': 'CLAUDE.md',
} as const;
const INIT_SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_GUIDE_TEMPLATE_FILES = {
  default: 'agent.md',
  codex: 'agent.md',
  'claude-code': 'agent.md',
} as const;
const CLAUDE_COMMAND_TEMPLATES = [
  {
    sourceRelativePath: 'claude-code-commands/anydocs-new-page.md',
    targetRelativePath: path.join('.claude', 'commands', 'anydocs-new-page.md'),
  },
  {
    sourceRelativePath: 'claude-code-commands/anydocs-publish-page.md',
    targetRelativePath: path.join('.claude', 'commands', 'anydocs-publish-page.md'),
  },
] as const;

function createBundledDocCandidates(relativePath: string): string[] {
  return [
    path.resolve(INIT_SERVICE_DIR, '../../docs', relativePath),
    path.resolve(INIT_SERVICE_DIR, '../../../../docs', relativePath),
  ];
}

async function ensurePathDoesNotExist(targetPath: string, entity: string, remediation: string) {
  try {
    await fs.access(targetPath);
    throw new ValidationError(`Cannot initialize project because ${entity} already exists at "${targetPath}".`, {
      entity,
      rule: 'init-target-must-not-conflict',
      remediation,
      metadata: { targetPath },
    });
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      throw error;
    }
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function resolveAgentGuideFileName(agent: InitProjectOptions['agent']): string {
  return agent ? PROJECT_AGENT_GUIDE_FILES[agent] : PROJECT_SKILL_GUIDE_FILE;
}

async function resolveBundledTemplatePath(
  candidates: string[],
  entity: string,
  remediation: string,
): Promise<string> {
  for (const candidatePath of candidates) {
    try {
      await fs.access(candidatePath);
      return candidatePath;
    } catch {
      continue;
    }
  }

  throw new ValidationError(`Cannot initialize project because the bundled ${entity} is missing.`, {
    entity,
    rule: 'init-bundled-template-missing',
    remediation,
    metadata: {
      searchedPaths: candidates,
    },
  });
}

async function copyBundledTemplate(
  projectRoot: string,
  plan: TemplateCopyPlan,
): Promise<string | null> {
  const targetPath = path.join(projectRoot, plan.targetRelativePath);

  try {
    await fs.access(targetPath);
    return null;
  } catch {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(plan.sourcePath, targetPath);
    return targetPath;
  }
}

async function resolveBundledTemplateCopyPlan(
  projectRoot: string,
  targetRelativePath: string,
  sourceCandidates: string[],
  entity: string,
  remediation: string,
): Promise<TemplateCopyPlan | null> {
  const targetPath = path.join(projectRoot, targetRelativePath);
  try {
    await fs.access(targetPath);
    return null;
  } catch {
    // Continue with template resolution; missing bundled templates must fail
    // before project initialization writes any source files.
  }

  return {
    targetRelativePath,
    sourcePath: await resolveBundledTemplatePath(sourceCandidates, entity, remediation),
  };
}

async function resolveProjectSkillGuideCopyPlan(
  projectRoot: string,
  agent?: InitProjectOptions['agent'],
): Promise<TemplateCopyPlan | null> {
  const templatePath =
    PROJECT_GUIDE_TEMPLATE_FILES[agent ?? 'default'];

  return resolveBundledTemplateCopyPlan(
    projectRoot,
    resolveAgentGuideFileName(agent),
    createBundledDocCandidates(templatePath),
    'project-agent-guide',
    `Reinstall @anydocs/core or restore docs/${templatePath} in the Anydocs repository before running anydocs init again.`,
  );
}

async function copyProjectSkillGuide(projectRoot: string, plan: TemplateCopyPlan | null): Promise<string | null> {
  if (!plan) {
    return null;
  }

  return copyBundledTemplate(projectRoot, plan);
}

async function resolveClaudeCommandTemplateCopyPlans(
  projectRoot: string,
  agent?: InitProjectOptions['agent'],
): Promise<TemplateCopyPlan[]> {
  if (agent !== 'claude-code') {
    return [];
  }

  const plans = await Promise.all(
    CLAUDE_COMMAND_TEMPLATES.map((template) =>
      resolveBundledTemplateCopyPlan(
        projectRoot,
        template.targetRelativePath,
        createBundledDocCandidates(template.sourceRelativePath),
        'claude-command-template',
        `Reinstall @anydocs/core or restore docs/${template.sourceRelativePath} in the Anydocs repository before running anydocs init again.`,
      ),
    ),
  );

  return plans.filter((plan): plan is TemplateCopyPlan => !!plan);
}

async function copyClaudeCommandTemplates(projectRoot: string, plans: TemplateCopyPlan[]): Promise<string[]> {
  const createdFiles: string[] = [];

  for (const plan of plans) {
    const copiedPath = await copyBundledTemplate(projectRoot, plan);

    if (copiedPath) {
      createdFiles.push(copiedPath);
    }
  }

  return createdFiles;
}

function createStarterPage(language: DocsLanguage): PageDoc {
  const isEnglish = language === 'en';

  return {
    id: 'welcome',
    lang: language,
    slug: 'welcome',
    title: isEnglish ? 'Welcome' : '欢迎',
    description: isEnglish
      ? 'Starter page created by anydocs init.'
      : '由 anydocs init 创建的起始页面。',
    status: 'published',
    content: { version: 1 as const, blocks: [] },
    render: {
      markdown: isEnglish ? '# Welcome' : '# 欢迎',
      plainText: isEnglish ? 'Welcome' : '欢迎',
    },
  };
}

function createStarterNavigation(language: DocsLanguage): NavigationDoc {
  const isEnglish = language === 'en';

  return {
    version: 1,
    items: [
      {
        type: 'section',
        title: isEnglish ? 'Getting Started' : '开始使用',
        children: [
          {
            type: 'page',
            pageId: 'welcome',
          },
        ],
      },
    ],
  };
}

export async function initializeProject(options: InitProjectOptions): Promise<InitProjectResult> {
  const defaultLanguage = options.defaultLanguage ?? DEFAULT_INIT_LANGUAGE;
  const languages = options.languages ?? DEFAULT_INIT_LANGUAGES;
  const config = validateProjectConfig(
    createDefaultProjectConfig({
      projectId: options.projectId,
      name: options.projectName,
      defaultLanguage,
      languages,
    }),
  );

  const paths = createProjectPathContract(options.repoRoot, config);

  await ensurePathDoesNotExist(
    paths.configFile,
    'project-config-file',
    'Choose a different target directory or remove the existing anydocs.config.json before running anydocs init again.',
  );

  const skillGuideCopyPlan = await resolveProjectSkillGuideCopyPlan(paths.projectRoot, options.agent);
  const claudeCommandCopyPlans = await resolveClaudeCommandTemplateCopyPlans(paths.projectRoot, options.agent);

  await initializeDocsRepository(createDocsRepository(paths.projectRoot), config.languages);
  await writeJson(paths.configFile, config);
  await writeJson(
    paths.workflowFile,
    exportWorkflowStandard({
      config,
      paths,
    }).definition,
  );

  const createdFiles = [paths.configFile, paths.workflowFile];
  const skillGuideFile = await copyProjectSkillGuide(paths.projectRoot, skillGuideCopyPlan);
  if (skillGuideFile) {
    createdFiles.push(skillGuideFile);
  }
  createdFiles.push(...(await copyClaudeCommandTemplates(paths.projectRoot, claudeCommandCopyPlans)));
  const repository = createDocsRepository(paths.projectRoot);

  for (const language of config.languages) {
    await saveNavigation(repository, language, createStarterNavigation(language));
    const starterPage = createStarterPage(language);
    await savePage(repository, language, starterPage);

    createdFiles.push(paths.languageRoots[language].navigationFile);
    createdFiles.push(path.join(paths.languageRoots[language].pagesDir, `${starterPage.id}.json`));
  }

  await fs.mkdir(paths.artifactRoot, { recursive: true });
  await fs.mkdir(paths.machineReadableRoot, { recursive: true });
  await fs.mkdir(paths.importsRoot, { recursive: true });
  await fs.mkdir(paths.apiSourcesRoot, { recursive: true });

  return {
    contract: {
      config,
      paths,
    },
    createdFiles,
  };
}
