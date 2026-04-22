import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createDefaultProjectConfig } from '../src/config/project-config.ts';
import { createProjectPathContract } from '../src/fs/project-paths.ts';
import { runBuildWorkflow } from '../src/services/build-service.ts';
import { initializeProject } from '../src/services/init-service.ts';
import { convertImportedLegacyContent } from '../src/services/legacy-conversion-service.ts';
import { importLegacyDocumentation } from '../src/services/legacy-import-service.ts';
import { assessWorkflowForwardCompatibility } from '../src/services/workflow-compatibility-service.ts';
import { syncWorkflowStandard } from '../src/services/workflow-sync-service.ts';
import {
  assertWorkflowStandardMatchesContract,
  createWorkflowStandardDefinition,
  exportWorkflowStandard,
  readWorkflowStandardDefinition,
  validateWorkflowStandardDefinition,
} from '../src/services/workflow-standard-service.ts';

async function createTempRepoRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'anydocs-workflow-standard-'));
}

test('createWorkflowStandardDefinition describes the canonical phase 1 content model and workflow', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const config = createDefaultProjectConfig({ languages: ['en', 'zh'], defaultLanguage: 'en' });
    const paths = createProjectPathContract(repoRoot, repoRoot, config);
    const definition = createWorkflowStandardDefinition({ config, paths });

    assert.equal(definition.standardId, 'anydocs-phase-1');
    assert.deepEqual(definition.enabledLanguages, ['en', 'zh']);
    assert.deepEqual(definition.publicationStatuses, ['draft', 'in_review', 'published']);
    assert.equal(definition.orchestration.publicationRule, 'published-only');
    assert.equal(definition.orchestration.futureCompatibleWithoutReinitialization, true);
    assert.deepEqual(definition.contentModel.projectConfigFields, [
      'version',
      'projectId',
      'name',
      'defaultLanguage',
      'languages',
      'site',
      'authoring',
      'build',
    ]);
    assert.deepEqual(definition.contentModel.pageOptionalFields, [
      'description',
      'template',
      'metadata',
      'tags',
      'updatedAt',
      'render',
    ]);

    assert.ok(definition.sourceFiles.some((file) => file.id === 'projectConfig'));
    assert.ok(definition.sourceFiles.some((file) => file.id === 'workflowStandard'));
    assert.ok(definition.sourceFiles.some((file) => file.id === 'page' && file.path.endsWith('{pageId}.json')));
    assert.ok(definition.generatedArtifacts.some((file) => file.id === 'llms'));
    assert.ok(definition.generatedArtifacts.some((file) => file.id === 'machineReadableRoot'));
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('exportWorkflowStandard returns Studio-independent guidance for external automation', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const config = createDefaultProjectConfig({ languages: ['en'] });
    const paths = createProjectPathContract(repoRoot, repoRoot, config);
    const exported = exportWorkflowStandard({ config, paths });

    assert.match(exported.markdownGuide, /Anydocs Workflow Standard/);
    assert.match(exported.markdownGuide, /UI Independent: yes/);
    assert.match(exported.markdownGuide, /Published Output Rule: published-only/);
    assert.match(exported.markdownGuide, /No project reinitialization is required/);
    assert.ok(
      exported.definition.sourceFiles.every((file) => !file.path.includes('studio')),
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('validateWorkflowStandardDefinition accepts exported workflow standards and exposes machine-readable index artifacts', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const config = createDefaultProjectConfig({ languages: ['en'] });
    const paths = createProjectPathContract(repoRoot, repoRoot, config);
    const exported = exportWorkflowStandard({ config, paths });
    const definition = validateWorkflowStandardDefinition(exported.definition);

    assert.equal(definition.standardId, 'anydocs-phase-1');
    assert.ok(definition.generatedArtifacts.some((file) => file.id === 'machineReadableIndex'));
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('assertWorkflowStandardMatchesContract accepts workflow definitions missing optional future source files', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const config = createDefaultProjectConfig({ languages: ['en'] });
    const paths = createProjectPathContract(repoRoot, repoRoot, config);
    const definition = createWorkflowStandardDefinition({ config, paths });

    assert.doesNotThrow(() =>
      assertWorkflowStandardMatchesContract(
        {
          ...definition,
          sourceFiles: definition.sourceFiles.filter((file) => file.id !== 'apiSource'),
        },
        { config, paths },
      ),
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('assessWorkflowForwardCompatibility confirms the same phase 1 standard can be reused across projects', async () => {
  const alphaRepoRoot = await createTempRepoRoot();
  const betaRepoRoot = await createTempRepoRoot();

  try {
    const alpha = await initializeProject({
      repoRoot: alphaRepoRoot,
      projectId: 'alpha',
      projectName: 'Alpha',
      languages: ['en'],
      defaultLanguage: 'en',
    });
    const beta = await initializeProject({
      repoRoot: betaRepoRoot,
      projectId: 'beta',
      projectName: 'Beta',
      languages: ['zh', 'en'],
      defaultLanguage: 'zh',
    });

    const alphaPersisted = await readWorkflowStandardDefinition(alpha.contract.paths.workflowFile);
    const betaPersisted = await readWorkflowStandardDefinition(beta.contract.paths.workflowFile);
    const alphaCompatibility = await assessWorkflowForwardCompatibility(alphaRepoRoot, 'alpha');
    const betaCompatibility = await assessWorkflowForwardCompatibility(betaRepoRoot, 'beta');

    assert.equal(alphaPersisted.standardId, betaPersisted.standardId);
    assert.deepEqual(alphaPersisted.contentModel, betaPersisted.contentModel);
    assert.deepEqual(alphaPersisted.orchestration, betaPersisted.orchestration);
    assert.equal(alphaCompatibility.compatible, true);
    assert.equal(betaCompatibility.compatible, true);
    assert.equal(alphaCompatibility.reusableAcrossProjects, true);
    assert.equal(betaCompatibility.futureCompatibleWithoutReinitialization, true);
  } finally {
    await rm(alphaRepoRoot, { recursive: true, force: true });
    await rm(betaRepoRoot, { recursive: true, force: true });
  }
});

test('assessWorkflowForwardCompatibility stays green after import, conversion, and build without reinitialization', async () => {
  const repoRoot = await createTempRepoRoot();
  const sourceRoot = await mkdtemp(path.join(os.tmpdir(), 'anydocs-workflow-standard-import-'));

  try {
    const initResult = await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    await writeFile(path.join(sourceRoot, 'guide.md'), '# Imported Guide\n\nNeeds review.\n', 'utf8');

    const importResult = await importLegacyDocumentation({
      repoRoot,
      sourceRoot,
      lang: 'en',
    });
    await convertImportedLegacyContent({
      repoRoot,
      importId: importResult.importId,
    });
    await runBuildWorkflow({ repoRoot });

    const persisted = await readWorkflowStandardDefinition(initResult.contract.paths.workflowFile);
    const compatibility = await assessWorkflowForwardCompatibility(repoRoot);

    assert.equal(persisted.standardId, 'anydocs-phase-1');
    assert.equal(compatibility.compatible, true);
    assert.equal(compatibility.externalAutomationReady, true);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
    await rm(sourceRoot, { recursive: true, force: true });
  }
});

test('syncWorkflowStandard returns a diff for stale workflow definitions and applies the canonical contract', async () => {
  const repoRoot = await createTempRepoRoot();

  try {
    const initResult = await initializeProject({ repoRoot, languages: ['en'], defaultLanguage: 'en' });
    const workflowFile = initResult.contract.paths.workflowFile;
    const persisted = JSON.parse(await readFile(workflowFile, 'utf8')) as Record<string, unknown>;
    const persistedContentModel = persisted.contentModel as Record<string, unknown>;
    persisted.contentModel = {
      ...persistedContentModel,
      pageOptionalFields: ['description'],
    };
    await writeFile(workflowFile, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');

    const dryRun = await syncWorkflowStandard(repoRoot);
    assert.equal(dryRun.applied, false);
    assert.ok(dryRun.diff.some((entry) => entry.path === 'contentModel.pageOptionalFields'));

    const apply = await syncWorkflowStandard(repoRoot, { apply: true });
    assert.equal(apply.applied, true);
    const synced = await readWorkflowStandardDefinition(workflowFile);
    assert.deepEqual(synced.contentModel.pageOptionalFields, [
      'description',
      'template',
      'metadata',
      'tags',
      'updatedAt',
      'render',
    ]);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
