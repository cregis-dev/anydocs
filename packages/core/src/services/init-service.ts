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

const PROJECT_SKILL_GUIDE_FILE = 'skill.md';
const PROJECT_AGENT_GUIDE_FILES = {
  codex: 'AGENTS.md',
  'claude-code': 'Claude.md',
} as const;
const INIT_SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_SKILL_GUIDE_PATH = path.resolve(INIT_SERVICE_DIR, '../../../../docs/skill.md');

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

async function copyProjectSkillGuide(
  projectRoot: string,
  agent?: InitProjectOptions['agent'],
): Promise<string | null> {
  const targetPath = path.join(projectRoot, resolveAgentGuideFileName(agent));

  try {
    await fs.access(targetPath);
    return null;
  } catch {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(REPO_SKILL_GUIDE_PATH, targetPath);
    return targetPath;
  }
}

function createStarterPage(language: DocsLanguage): PageDoc<Record<string, never>> {
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
    content: {},
    render: {
      markdown: isEnglish ? '# Welcome' : '# 欢迎',
      plainText: isEnglish ? 'Welcome' : '欢迎',
    },
  };
}

function createStarterNavigation(): NavigationDoc {
  return {
    version: 1,
    items: [
      {
        type: 'section',
        title: 'Getting Started',
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
  const config = validateProjectConfig(
    createDefaultProjectConfig({
      projectId: options.projectId,
      name: options.projectName,
      defaultLanguage: options.defaultLanguage,
      languages: options.languages,
    }),
  );

  const paths = createProjectPathContract(options.repoRoot, config);

  await ensurePathDoesNotExist(
    paths.configFile,
    'project-config-file',
    'Choose a different target directory or remove the existing anydocs.config.json before running anydocs init again.',
  );

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
  const skillGuideFile = await copyProjectSkillGuide(paths.projectRoot, options.agent);
  if (skillGuideFile) {
    createdFiles.push(skillGuideFile);
  }
  const repository = createDocsRepository(paths.projectRoot);
  const starterNavigation = createStarterNavigation();

  for (const language of config.languages) {
    await saveNavigation(repository, language, starterNavigation);
    const starterPage = createStarterPage(language);
    await savePage(repository, language, starterPage);

    createdFiles.push(paths.languageRoots[language].navigationFile);
    createdFiles.push(path.join(paths.languageRoots[language].pagesDir, `${starterPage.id}.json`));
  }

  await fs.mkdir(paths.artifactRoot, { recursive: true });
  await fs.mkdir(paths.machineReadableRoot, { recursive: true });
  await fs.mkdir(paths.importsRoot, { recursive: true });

  return {
    contract: {
      config,
      paths,
    },
    createdFiles,
  };
}
