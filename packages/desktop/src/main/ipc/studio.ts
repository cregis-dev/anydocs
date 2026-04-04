import path from 'node:path'

import {
  createApiSourceRepository,
  createDocsRepository,
  createDefaultProjectConfig,
  docContentToYoopta,
  deleteApiSource,
  deletePage,
  DEFAULT_PROJECT_ID,
  initializeProject,
  initializeApiSourceRepository,
  listApiSources,
  listPages,
  loadNavigation,
  loadPage,
  loadProjectContract,
  normalizeSlug,
  runBuildWorkflow,
  runPreviewWorkflow,
  saveApiSource,
  saveNavigation,
  savePage,
  updateProjectConfig,
  validateDocContentV1,
  yooptaToDocContent,
  type ApiSourceDoc,
  type ApiSourceRepository,
  type BuildWorkflowResult,
  type DeletePageResult,
  type DocsRepository,
  type DocsLang,
  type NavigationDoc,
  type PageDoc,
  type PreviewWorkflowResult,
  type ProjectConfig,
  type ProjectContract
} from '@anydocs/core'

type StudioProjectSettingsPatch = {
  name?: string
  languages?: DocsLang[]
  defaultLanguage?: DocsLang
  site?: {
    theme?: {
      id?: string
      branding?: {
        siteTitle?: string
        homeLabel?: string
        logoSrc?: string
        logoAlt?: string
      }
      chrome?: {
        showSearch?: boolean
      }
      colors?: {
        primary?: string
        primaryForeground?: string
        accent?: string
        accentForeground?: string
        sidebarActive?: string
        sidebarActiveForeground?: string
      }
      codeTheme?: 'github-light' | 'github-dark'
    }
  }
  build?: {
    outputDir?: string
  }
}

type PreviewRegistryEntry = {
  key: string
  result: PreviewWorkflowResult
  docsPath: string
  previewUrl: string
  exited: boolean
  exitPromise: Promise<void>
}

const previewRegistry = new Map<string, PreviewRegistryEntry>()

function resolveRepoRoot(customPath?: string): string {
  if (!customPath) {
    return process.cwd()
  }

  return path.resolve(customPath)
}

async function resolveProjectContract(
  projectId = DEFAULT_PROJECT_ID,
  customPath?: string
): Promise<ProjectContract> {
  const result = await loadProjectContract(resolveRepoRoot(customPath), projectId || undefined)
  if (!result.ok) {
    throw result.error
  }

  return result.value
}

async function getDocsRepository(
  projectId = DEFAULT_PROJECT_ID,
  customPath?: string
): Promise<DocsRepository> {
  const contract = await resolveProjectContract(projectId, customPath)
  return createDocsRepository(contract.paths.projectRoot)
}

function derivePageIdFromSlug(slug: string): string {
  const normalized = normalizeSlug(slug)
  const fallback = `page-${Date.now().toString(36)}`
  const leaf = normalized.split('/').filter(Boolean).at(-1) ?? fallback
  const safe = leaf
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return safe || fallback
}

function toStudioPageDoc(page: PageDoc<unknown>): PageDoc {
  const canonical = validateDocContentV1(page.content)

  return {
    ...page,
    content: canonical.ok ? docContentToYoopta(page.content as Parameters<typeof docContentToYoopta>[0]) : page.content
  }
}

function toStoredPageDoc(page: PageDoc): PageDoc<unknown> {
  return {
    ...page,
    content: yooptaToDocContent(page.content)
  }
}

function getPreviewRegistryKey(projectRoot: string): string {
  return path.resolve(projectRoot)
}

function getActivePreview(projectRoot: string): PreviewRegistryEntry | null {
  const key = getPreviewRegistryKey(projectRoot)
  const entry = previewRegistry.get(key)
  if (!entry) {
    return null
  }

  if (entry.exited) {
    previewRegistry.delete(key)
    return null
  }

  return entry
}

function registerPreview(projectRoot: string, result: PreviewWorkflowResult): PreviewRegistryEntry {
  const key = getPreviewRegistryKey(projectRoot)
  const entry: PreviewRegistryEntry = {
    key,
    result,
    docsPath: result.docsPath,
    previewUrl: new URL(result.docsPath, `${result.url}/`).toString(),
    exited: false,
    exitPromise: Promise.resolve()
  }

  entry.exitPromise = result.waitUntilExit().then(() => {
    entry.exited = true
    if (previewRegistry.get(key) === entry) {
      previewRegistry.delete(key)
    }
  })

  previewRegistry.set(key, entry)
  return entry
}

async function stopActivePreview(projectRoot: string): Promise<boolean> {
  const entry = getActivePreview(projectRoot)
  if (!entry) {
    return false
  }

  previewRegistry.delete(entry.key)
  await entry.result.stop()
  await entry.exitPromise
  return true
}

export async function getProject(projectId = '', customPath?: string): Promise<ProjectContract> {
  return resolveProjectContract(projectId || DEFAULT_PROJECT_ID, customPath)
}

export async function getPages(
  lang: DocsLang,
  projectId = '',
  customPath?: string
): Promise<{ pages: PageDoc[] }> {
  return {
    pages: (await listPages(
      await getDocsRepository(projectId || DEFAULT_PROJECT_ID, customPath),
      lang
    )).map((page) => toStudioPageDoc(page))
  }
}

export async function getPage(
  lang: DocsLang,
  pageId: string,
  projectId = '',
  customPath?: string
): Promise<PageDoc> {
  const page = await loadPage(
    await getDocsRepository(projectId || DEFAULT_PROJECT_ID, customPath),
    lang,
    pageId
  )
  if (!page) {
    throw new Error(`Page "${pageId}" not found.`)
  }

  return toStudioPageDoc(page)
}

export async function putPage(
  lang: DocsLang,
  page: PageDoc,
  projectId = '',
  customPath?: string
): Promise<PageDoc> {
  const saved = await savePage(
    await getDocsRepository(projectId || DEFAULT_PROJECT_ID, customPath),
    lang,
    toStoredPageDoc(page)
  )

  return toStudioPageDoc(saved)
}

export async function postPage(
  lang: DocsLang,
  input: { slug: string; title: string },
  projectId = '',
  customPath?: string
): Promise<PageDoc> {
  const normalizedSlug = normalizeSlug(input.slug)
  const title = input.title.trim() || 'Untitled'

  return savePage(await getDocsRepository(projectId || DEFAULT_PROJECT_ID, customPath), lang, {
    id: derivePageIdFromSlug(normalizedSlug),
    lang,
    slug: normalizedSlug,
    title,
    status: 'draft',
    content: {
      version: 1,
      blocks: []
    },
    render: {
      markdown: `# ${title}`,
      plainText: title
    }
  }).then((page) => toStudioPageDoc(page))
}

export async function removePage(
  lang: DocsLang,
  pageId: string,
  projectId = '',
  customPath?: string
): Promise<DeletePageResult> {
  return deletePage(
    await getDocsRepository(projectId || DEFAULT_PROJECT_ID, customPath),
    lang,
    pageId
  )
}

export async function getNavigation(
  lang: DocsLang,
  projectId = '',
  customPath?: string
): Promise<NavigationDoc> {
  return loadNavigation(await getDocsRepository(projectId || DEFAULT_PROJECT_ID, customPath), lang)
}

export async function putNavigation(
  lang: DocsLang,
  navigation: NavigationDoc,
  projectId = '',
  customPath?: string
): Promise<NavigationDoc> {
  const repository = await getDocsRepository(projectId || DEFAULT_PROJECT_ID, customPath)
  const pages = await listPages(repository, lang)
  return saveNavigation(repository, lang, navigation, {
    existingPageIds: pages.map((page) => page.id)
  })
}

async function getApiSourceRepository(
  projectId = DEFAULT_PROJECT_ID,
  customPath?: string
): Promise<ApiSourceRepository> {
  const contract = await resolveProjectContract(projectId, customPath)
  return createApiSourceRepository(contract.paths.projectRoot)
}

export async function getApiSources(
  projectId = '',
  customPath?: string
): Promise<{ sources: ApiSourceDoc[] }> {
  return {
    sources: await listApiSources(
      await getApiSourceRepository(projectId || DEFAULT_PROJECT_ID, customPath)
    )
  }
}

export async function putApiSources(
  input: { sources?: ApiSourceDoc[] } | ApiSourceDoc[],
  projectId = '',
  customPath?: string
): Promise<{ sources: ApiSourceDoc[] }> {
  const repository = await getApiSourceRepository(projectId || DEFAULT_PROJECT_ID, customPath)
  await initializeApiSourceRepository(repository)

  const nextSources = Array.isArray(input) ? input : (input.sources ?? [])
  const existing = await listApiSources(repository)
  const nextIds = new Set(nextSources.map((source) => source.id))

  for (const source of nextSources) {
    await saveApiSource(repository, source)
  }

  for (const source of existing) {
    if (!nextIds.has(source.id)) {
      await deleteApiSource(repository, source.id)
    }
  }

  return {
    sources: await listApiSources(repository)
  }
}

export async function putProject(
  patch: StudioProjectSettingsPatch,
  projectId = '',
  customPath?: string
): Promise<ProjectContract> {
  const contract = await resolveProjectContract(projectId || DEFAULT_PROJECT_ID, customPath)
  const themePatch = patch.site?.theme
  const currentTheme = contract.config.site.theme
  const nextPatch: Partial<ProjectConfig> = {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.languages !== undefined ? { languages: patch.languages } : {}),
    ...(patch.defaultLanguage !== undefined ? { defaultLanguage: patch.defaultLanguage } : {}),
    ...(patch.build !== undefined ? { build: patch.build } : {}),
    ...(themePatch
      ? {
          site: {
            theme: {
              ...currentTheme,
              ...(themePatch.id !== undefined ? { id: themePatch.id } : {}),
              ...(themePatch.branding !== undefined ? { branding: themePatch.branding } : {}),
              ...(themePatch.chrome !== undefined ? { chrome: themePatch.chrome } : {}),
              ...(themePatch.colors !== undefined ? { colors: themePatch.colors } : {}),
              ...(themePatch.codeTheme !== undefined ? { codeTheme: themePatch.codeTheme } : {})
            }
          }
        }
      : {})
  }
  const result = await updateProjectConfig(
    resolveRepoRoot(customPath),
    nextPatch,
    contract.config.projectId
  )
  if (!result.ok) {
    throw result.error
  }

  return resolveProjectContract(contract.config.projectId, customPath)
}

export async function postBuild(
  projectId = '',
  customPath?: string
): Promise<Pick<BuildWorkflowResult, 'artifactRoot' | 'languages'>> {
  const contract = await resolveProjectContract(projectId || DEFAULT_PROJECT_ID, customPath)
  await stopActivePreview(contract.paths.projectRoot)

  const result = await runBuildWorkflow({
    repoRoot: contract.paths.repoRoot,
    projectId: contract.config.projectId
  })

  return {
    artifactRoot: result.artifactRoot,
    languages: result.languages
  }
}

export async function postPreview(
  projectId = '',
  customPath?: string
): Promise<{ docsPath: string; previewUrl: string }> {
  const contract = await resolveProjectContract(projectId || DEFAULT_PROJECT_ID, customPath)
  const projectRoot = contract.paths.projectRoot

  await stopActivePreview(projectRoot)

  const result = await runPreviewWorkflow({
    repoRoot: contract.paths.repoRoot,
    projectId: contract.config.projectId
  })
  const entry = registerPreview(projectRoot, result)
  const activePreview = getActivePreview(projectRoot) ?? entry

  return {
    docsPath: activePreview.docsPath,
    previewUrl: activePreview.previewUrl
  }
}

export async function ensureProject(projectPath: string): Promise<ProjectContract> {
  const resolvedPath = path.resolve(projectPath)
  const contract = await loadProjectContract(resolvedPath)
  if (contract.ok) {
    return contract.value
  }

  const result = await initializeProject({
    repoRoot: resolvedPath,
    projectId: createDefaultProjectConfig().projectId
  })

  return result.contract
}
