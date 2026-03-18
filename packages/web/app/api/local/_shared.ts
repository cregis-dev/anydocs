import { ValidationError, SUPPORTED_DOCS_LANGUAGES } from '@anydocs/core';
import type { DocsLang } from '@/lib/docs/types';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type LocalApiErrorBody = {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
};

export type LocalApiProjectQuery = {
  projectId: string;
  customPath?: string;
};

function makeValidationError(
  message: string,
  rule: string,
  metadata?: Record<string, unknown>,
): ValidationError {
  return new ValidationError(message, {
    entity: 'studio-local-api',
    rule,
    remediation: 'Fix the local Studio API request before retrying.',
    ...(metadata ? { metadata } : {}),
  });
}

export function readProjectQuery(request: NextRequest): LocalApiProjectQuery {
  const projectId = request.nextUrl.searchParams.get('projectId')?.trim() ?? '';
  const customPath = request.nextUrl.searchParams.get('path')?.trim() || undefined;

  return { projectId, customPath };
}

export function requireQueryParam(request: NextRequest, key: string): string {
  const value = request.nextUrl.searchParams.get(key)?.trim();
  if (!value) {
    throw makeValidationError(`Missing required query parameter "${key}".`, 'required-query-param', { key });
  }

  return value;
}

export function requireLang(request: NextRequest): DocsLang {
  const lang = requireQueryParam(request, 'lang');
  if (!SUPPORTED_DOCS_LANGUAGES.includes(lang as DocsLang)) {
    throw makeValidationError(`Unsupported language "${lang}".`, 'supported-language', { lang });
  }

  return lang as DocsLang;
}

export function requirePageId(request: NextRequest): string {
  return requireQueryParam(request, 'pageId');
}

export async function readJsonBody<T>(request: NextRequest): Promise<T> {
  const raw = await request.text();
  if (!raw.trim()) {
    throw makeValidationError('Request body is required.', 'request-body-required');
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw makeValidationError('Request body must be valid JSON.', 'request-body-json-valid', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export function json<T>(payload: T, status = 200): NextResponse<T> {
  return NextResponse.json(payload, { status });
}

export function jsonError(message: string, status: number, extra?: Omit<LocalApiErrorBody, 'error'>) {
  return NextResponse.json(
    {
      error: message,
      ...(extra ?? {}),
    } satisfies LocalApiErrorBody,
    { status },
  );
}

export function handleRouteError(error: unknown): NextResponse<LocalApiErrorBody> {
  if (error instanceof ValidationError) {
    return jsonError(error.message, 400, {
      code: error.code,
      details: {
        entity: error.details.entity,
        rule: error.details.rule,
        ...(error.details.remediation ? { remediation: error.details.remediation } : {}),
        ...(error.details.metadata ? { metadata: error.details.metadata } : {}),
      },
    });
  }

  if (error instanceof Error) {
    return jsonError(error.message, 500);
  }

  return jsonError('Unexpected local API error.', 500);
}
