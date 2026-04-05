import { getDocsUiCopy } from '../../components/docs/docs-ui-copy.ts';
import type { DocsLang, PageStatus } from '../docs/types.ts';

export type BlueprintMetaTone = 'neutral' | 'info' | 'success' | 'warning';
export type BlueprintPageMode = 'overview' | 'review';

function getBlueprintLocale(lang: DocsLang) {
  return lang === 'zh' ? 'zh-CN' : 'en-US';
}

export function formatBlueprintDate(value: string | undefined, lang: DocsLang) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(getBlueprintLocale(lang), {
    dateStyle: 'medium',
  }).format(date);
}

export function formatBlueprintValue(value: unknown) {
  if (value == null || value === '') {
    return null;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

export function formatBlueprintList(value: unknown): string[] {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => formatBlueprintList(item))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.includes('\n')) {
      return trimmed
        .split('\n')
        .map((item) => item.replace(/^[-*•\d.\s]+/, '').trim())
        .filter(Boolean);
    }

    return [trimmed];
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }

  return [];
}

export function getBlueprintStatusTone(status: PageStatus): BlueprintMetaTone {
  if (status === 'published') return 'success';
  if (status === 'in_review') return 'warning';
  return 'neutral';
}

export function getBlueprintStatusLabel(status: PageStatus, lang: DocsLang) {
  const copy = getDocsUiCopy(lang).blueprint;

  if (status === 'published') return copy.statusPublished;
  if (status === 'in_review') return copy.statusInReview;
  return copy.statusDraft;
}

export function getBlueprintReviewStateLabel(state: string, lang: DocsLang) {
  const copy = getDocsUiCopy(lang).blueprint;

  if (state === 'draft') return copy.reviewStateDraft;
  if (state === 'in-review') return copy.reviewStateInReview;
  if (state === 'approved') return copy.reviewStateApproved;
  if (state === 'blocked') return copy.reviewStateBlocked;
  return state;
}

export function getBlueprintDocTypeLabel(value: string, lang: DocsLang) {
  const copy = getDocsUiCopy(lang).blueprint;

  if (value === 'prd') return copy.docTypePrd;
  if (value === 'tech-spec') return copy.docTypeTechSpec;
  if (value === 'review-note') return copy.docTypeReviewNote;
  return value;
}

function normalizeBlueprintModeToken(value: string) {
  return value.toLowerCase().trim();
}

export function inferBlueprintPageMode({
  title,
  docType,
  tags,
  hasReviewSignals,
  hasDecisionSummary,
}: {
  title: string;
  docType: string | null;
  tags?: string[];
  hasReviewSignals: boolean;
  hasDecisionSummary: boolean;
}): BlueprintPageMode {
  const normalizedDocType = normalizeBlueprintModeToken(docType ?? '');

  if (normalizedDocType === 'tech-spec' || normalizedDocType === 'review-note' || normalizedDocType === 'prd') {
    return 'review';
  }

  if (hasReviewSignals || hasDecisionSummary) {
    return 'review';
  }

  const normalizedTitle = normalizeBlueprintModeToken(title);
  const normalizedTags = (tags ?? []).map(normalizeBlueprintModeToken);
  const overviewHints = ['overview', 'summary', '概览', '总览'];

  const matchesOverviewHint = overviewHints.some((hint) => (
    normalizedTitle.includes(hint) || normalizedTags.some((tag) => tag.includes(hint))
  ));

  return matchesOverviewHint ? 'overview' : 'review';
}
