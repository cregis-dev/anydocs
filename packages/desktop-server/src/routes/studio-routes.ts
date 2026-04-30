import type { IncomingMessage, ServerResponse } from 'node:http';

import { ValidationError } from '../../../core/dist/index.js';

import { readJsonBody, sendJson } from '../http.ts';
import type {
  ApiSourceDoc,
  DesktopServerOptions,
  DesktopServerResponse,
  DocsLang,
  IpcErrorPayload,
  NavigationDoc,
  PageDoc,
  ProjectContract,
  DeletePageResult,
  StudioPageCreateInput,
  StudioProjectCreateInput,
  StudioProjectCreateResponse,
  StudioProjectScope,
  StudioProjectSettingsPatch,
} from '../types.ts';
import {
  createProject,
  getApiSources,
  getNavigation,
  getPage,
  getPages,
  getProject,
  postBuild,
  postPage,
  postPreview,
  postPreviewStop,
  putApiSources,
  putNavigation,
  putPage,
  putProject,
  removePage,
} from '../services/studio-service.ts';

type RouteContext = {
  defaultProjectRoot: string;
  logger?: DesktopServerOptions['logger'];
};

function toErrorPayload(error: unknown): IpcErrorPayload {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const code = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : 'IPC_ERROR';
    const message = typeof (error as { message?: unknown }).message === 'string' ? (error as { message: string }).message : 'Unexpected IPC error';
    const details = 'details' in error && typeof (error as { details?: unknown }).details === 'object'
      ? ((error as { details?: Record<string, unknown> }).details ?? undefined)
      : undefined;

    return details ? { code, message, details } : { code, message };
  }

  if (error instanceof Error) {
    return { code: 'IPC_ERROR', message: error.message };
  }

  return { code: 'IPC_ERROR', message: 'Unexpected IPC error' };
}

function resolveStatusCode(error: unknown): number {
  if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'VALIDATION_ERROR') {
    return 400;
  }

  return 500;
}

function success<T>(data: T): DesktopServerResponse<T> {
  return { success: true, data };
}

function failure(error: unknown): DesktopServerResponse<never> {
  return { success: false, error: toErrorPayload(error) };
}

function resolveScope(body: Partial<StudioProjectScope> | undefined, defaultProjectRoot: string): StudioProjectScope {
  return {
    projectId: typeof body?.projectId === 'string' && body.projectId.length > 0 ? body.projectId : undefined,
    projectPath: typeof body?.projectPath === 'string' && body.projectPath.length > 0 ? body.projectPath : defaultProjectRoot,
  };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

async function handleStudioRoute(
  pathname: string,
  body: Record<string, unknown>,
  context: RouteContext,
  response: ServerResponse,
): Promise<void> {
  const scope = resolveScope(body, context.defaultProjectRoot);

  switch (pathname) {
    case '/studio/project/get': {
      const project = await getProject(scope, context.defaultProjectRoot);
      sendJson(response, 200, success(project satisfies ProjectContract));
      return;
    }
    case '/studio/project/put': {
      const patch = isJsonObject(body.patch) ? (body.patch as StudioProjectSettingsPatch) : {};
      const project = await putProject(patch, scope, context.defaultProjectRoot);
      sendJson(response, 200, success(project satisfies ProjectContract));
      return;
    }
    case '/studio/project/create': {
      const input = isJsonObject(body.input) ? (body.input as StudioProjectCreateInput) : (body as StudioProjectCreateInput);
      const result = await createProject(input);
      sendJson(response, 200, success(result satisfies StudioProjectCreateResponse));
      return;
    }
    case '/studio/pages/get': {
      const lang = (typeof body.lang === 'string' ? body.lang : 'en') as DocsLang;
      const pages = await getPages(lang, scope, context.defaultProjectRoot);
      sendJson(response, 200, success(pages));
      return;
    }
    case '/studio/page/get': {
      const lang = (typeof body.lang === 'string' ? body.lang : 'en') as DocsLang;
      const pageId = String(body.pageId ?? '');
      const page = await getPage(lang, pageId, scope, context.defaultProjectRoot);
      sendJson(response, 200, success(page satisfies PageDoc));
      return;
    }
    case '/studio/page/put': {
      const lang = (typeof body.lang === 'string' ? body.lang : 'en') as DocsLang;
      const page = isJsonObject(body.page) ? (body.page as PageDoc) : ({} as PageDoc);
      const saved = await putPage(lang, page, scope, context.defaultProjectRoot);
      sendJson(response, 200, success(saved satisfies PageDoc));
      return;
    }
    case '/studio/page/post': {
      const lang = (typeof body.lang === 'string' ? body.lang : 'en') as DocsLang;
      const input = isJsonObject(body.input) ? (body.input as StudioPageCreateInput) : { slug: '', title: '' };
      const page = await postPage(lang, input, scope, context.defaultProjectRoot);
      sendJson(response, 200, success(page satisfies PageDoc));
      return;
    }
    case '/studio/page/delete': {
      const lang = (typeof body.lang === 'string' ? body.lang : 'en') as DocsLang;
      const pageId = String(body.pageId ?? '');
      const result: DeletePageResult = await removePage(lang, pageId, scope, context.defaultProjectRoot);
      sendJson(response, 200, success(result));
      return;
    }
    case '/studio/navigation/get': {
      const lang = (typeof body.lang === 'string' ? body.lang : 'en') as DocsLang;
      const navigation = await getNavigation(lang, scope, context.defaultProjectRoot);
      sendJson(response, 200, success(navigation satisfies NavigationDoc));
      return;
    }
    case '/studio/navigation/put': {
      const lang = (typeof body.lang === 'string' ? body.lang : 'en') as DocsLang;
      const navigation = isJsonObject(body.navigation) ? (body.navigation as NavigationDoc) : { version: 1, items: [] };
      const saved = await putNavigation(lang, navigation, scope, context.defaultProjectRoot);
      sendJson(response, 200, success(saved satisfies NavigationDoc));
      return;
    }
    case '/studio/api-sources/get': {
      const sources = await getApiSources(scope, context.defaultProjectRoot);
      sendJson(response, 200, success(sources));
      return;
    }
    case '/studio/api-sources/put': {
      const sources = await putApiSources(
        Array.isArray(body.sources) ? (body.sources as ApiSourceDoc[]) : { sources: body.sources as ApiSourceDoc[] | undefined },
        scope,
        context.defaultProjectRoot,
      );
      sendJson(response, 200, success(sources));
      return;
    }
    case '/studio/build/post': {
      const result = await postBuild(scope, context.defaultProjectRoot);
      sendJson(response, 200, success(result));
      return;
    }
    case '/studio/preview/post': {
      const result = await postPreview(scope, context.defaultProjectRoot);
      sendJson(response, 200, success(result));
      return;
    }
    case '/studio/preview/stop': {
      const result = await postPreviewStop();
      sendJson(response, 200, success(result));
      return;
    }
    default: {
      sendJson(response, 404, failure(new Error(`Unknown route "${pathname}".`)));
    }
  }
}

export function createStudioRouteHandler(context: RouteContext) {
  return async function studioRouteHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = url.pathname;

    try {
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
        });
        response.end();
        return;
      }

      if (pathname === '/health') {
        if (request.method !== 'GET') {
          sendJson(response, 405, failure(new Error('Method not allowed.')));
          return;
        }

        sendJson(
          response,
          200,
          success({
            status: 'ok',
            service: 'desktop-server',
            version: '1.0.0',
          }),
        );
        return;
      }

      if (!pathname.startsWith('/studio/')) {
        sendJson(response, 404, failure(new Error(`Unknown route "${pathname}".`)));
        return;
      }

      if (request.method !== 'POST') {
        sendJson(response, 405, failure(new Error('Method not allowed.')));
        return;
      }

      const parsedBody = await readJsonBody<unknown>(request);
      if (parsedBody !== null && !isJsonObject(parsedBody)) {
        throw new ValidationError('Request body must be a JSON object.', {
          entity: 'request-body',
          rule: 'request-body-json-object',
          remediation: 'Send a JSON object body, for example {"input":{"projectPath":"/absolute/path"}}.',
        });
      }

      await handleStudioRoute(pathname, (parsedBody ?? {}) as Record<string, unknown>, context, response);
    } catch (error) {
      sendJson(response, resolveStatusCode(error), failure(error));
    }
  };
}
