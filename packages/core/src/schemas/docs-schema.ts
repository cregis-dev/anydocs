import {
  isDocsLang,
  isPageStatus,
  type NavItem,
  type NavigationDoc,
  type PageDoc,
  type PageReview,
  type PageReviewWarning,
} from '../types/docs.ts';
import { ValidationError } from '../errors/validation-error.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createDocsValidationError(
  entity: string,
  rule: string,
  remediation: string,
  metadata?: Record<string, unknown>,
): ValidationError {
  return new ValidationError(`Validation failed for "${entity}" on rule "${rule}".`, {
    entity,
    rule,
    remediation,
    metadata,
  });
}

function assertNonEmptyString(
  value: unknown,
  entity: string,
  rule: string,
  remediation: string,
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createDocsValidationError(entity, rule, remediation, { received: value });
  }
}

function assertOptionalStringArray(
  value: unknown,
  entity: string,
  rule: string,
  remediation: string,
): asserts value is string[] | undefined {
  if (value == null) {
    return;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw createDocsValidationError(entity, rule, remediation, { received: value });
  }
}

function assertOptionalNavGroupId(value: unknown, pathLabel: string): string | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createDocsValidationError(
      'nav-item',
      'group-id-string',
      'Use a non-empty string for "id" on navigation groups when a stable group id is needed.',
      { path: pathLabel, received: value },
    );
  }

  const trimmed = value.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
    throw createDocsValidationError(
      'nav-item',
      'group-id-format',
      'Use lowercase letters, numbers, and hyphens only for navigation group ids.',
      { path: pathLabel, received: value },
    );
  }

  return trimmed;
}

function validateNavItem(input: unknown, pathLabel: string): NavItem {
  if (!isRecord(input) || typeof input.type !== 'string') {
    throw createDocsValidationError(
      'nav-item',
      'nav-item-structure',
      'Ensure each navigation item is an object with a valid "type" field.',
      { path: pathLabel, received: input },
    );
  }

  switch (input.type) {
    case 'section':
    case 'folder': {
      assertNonEmptyString(
        input.title,
        'nav-item',
        'group-title-required',
        'Provide a non-empty "title" for section and folder navigation items.',
      );

      if (!Array.isArray(input.children)) {
        throw createDocsValidationError(
          'nav-item',
          'group-children-required',
          'Provide a "children" array for section and folder navigation items.',
          { path: pathLabel, received: input.children },
        );
      }

      return {
        type: input.type,
        ...(assertOptionalNavGroupId(input.id, pathLabel) ? { id: assertOptionalNavGroupId(input.id, pathLabel) } : {}),
        title: input.title.trim(),
        children: input.children.map((child, index) =>
          validateNavItem(child, `${pathLabel}.children[${index}]`),
        ),
      };
    }
    case 'page': {
      assertNonEmptyString(
        input.pageId,
        'nav-item',
        'page-id-required',
        'Provide a non-empty "pageId" for page navigation items.',
      );

      if (input.titleOverride != null && typeof input.titleOverride !== 'string') {
        throw createDocsValidationError(
          'nav-item',
          'title-override-string',
          'Use a string for "titleOverride" when overriding a page title.',
          { path: pathLabel, received: input.titleOverride },
        );
      }

      if (input.hidden != null && typeof input.hidden !== 'boolean') {
        throw createDocsValidationError(
          'nav-item',
          'hidden-boolean',
          'Use a boolean for "hidden" on page navigation items.',
          { path: pathLabel, received: input.hidden },
        );
      }

      return {
        type: 'page',
        pageId: input.pageId.trim(),
        ...(input.titleOverride ? { titleOverride: input.titleOverride } : {}),
        ...(typeof input.hidden === 'boolean' ? { hidden: input.hidden } : {}),
      };
    }
    case 'link': {
      assertNonEmptyString(
        input.title,
        'nav-item',
        'link-title-required',
        'Provide a non-empty "title" for link navigation items.',
      );
      assertNonEmptyString(
        input.href,
        'nav-item',
        'link-href-required',
        'Provide a non-empty "href" for link navigation items.',
      );

      return {
        type: 'link',
        title: input.title.trim(),
        href: input.href.trim(),
      };
    }
    default:
      throw createDocsValidationError(
        'nav-item',
        'unsupported-nav-item-type',
        'Use only section, folder, page, or link navigation item types.',
        { path: pathLabel, received: input.type },
      );
  }
}

function validateReviewWarning(input: unknown, index: number): PageReviewWarning {
  if (!isRecord(input)) {
    throw createDocsValidationError(
      'page-review-warning',
      'page-review-warning-object',
      'Use an object for each page review warning entry.',
      { index, received: input },
    );
  }

  assertNonEmptyString(
    input.code,
    'page-review-warning',
    'page-review-warning-code-required',
    'Provide a non-empty code for each review warning.',
  );
  assertNonEmptyString(
    input.message,
    'page-review-warning',
    'page-review-warning-message-required',
    'Provide a non-empty message for each review warning.',
  );

  if (input.remediation != null && typeof input.remediation !== 'string') {
    throw createDocsValidationError(
      'page-review-warning',
      'page-review-warning-remediation-string',
      'Use a string remediation when a review warning includes remediation guidance.',
      { index, received: input.remediation },
    );
  }

  if (input.metadata != null && !isRecord(input.metadata)) {
    throw createDocsValidationError(
      'page-review-warning',
      'page-review-warning-metadata-object',
      'Use an object for review warning metadata when it is present.',
      { index, received: input.metadata },
    );
  }

  return {
    code: input.code.trim(),
    message: input.message.trim(),
    ...(typeof input.remediation === 'string' ? { remediation: input.remediation } : {}),
    ...(isRecord(input.metadata) ? { metadata: input.metadata } : {}),
  };
}

function validatePageReview(input: unknown): PageReview {
  if (!isRecord(input)) {
    throw createDocsValidationError(
      'page-review',
      'page-review-object',
      'Use an object for page review metadata when review metadata is present.',
      { received: input },
    );
  }

  if (typeof input.required !== 'boolean') {
    throw createDocsValidationError(
      'page-review',
      'page-review-required-boolean',
      'Provide a boolean "required" field on page review metadata.',
      { received: input.required },
    );
  }

  if (input.sourceType !== 'legacy-import' && input.sourceType !== 'ai-generated') {
    throw createDocsValidationError(
      'page-review',
      'page-review-source-type',
      'Use "legacy-import" or "ai-generated" for page review sourceType.',
      { received: input.sourceType },
    );
  }

  assertNonEmptyString(
    input.sourceId,
    'page-review',
    'page-review-source-id-required',
    'Provide a non-empty sourceId for page review metadata.',
  );

  if (input.itemId != null && typeof input.itemId !== 'string') {
    throw createDocsValidationError(
      'page-review',
      'page-review-item-id-string',
      'Use a string itemId when page review metadata includes an itemId.',
      { received: input.itemId },
    );
  }

  if (input.sourcePath != null && typeof input.sourcePath !== 'string') {
    throw createDocsValidationError(
      'page-review',
      'page-review-source-path-string',
      'Use a string sourcePath when page review metadata includes a sourcePath.',
      { received: input.sourcePath },
    );
  }

  if (input.approvedAt != null && typeof input.approvedAt !== 'string') {
    throw createDocsValidationError(
      'page-review',
      'page-review-approved-at-string',
      'Use an ISO 8601 string for approvedAt when review approval metadata is present.',
      { received: input.approvedAt },
    );
  }

  if (input.metadata != null && !isRecord(input.metadata)) {
    throw createDocsValidationError(
      'page-review',
      'page-review-metadata-object',
      'Use an object for page review metadata.metadata when present.',
      { received: input.metadata },
    );
  }

  if (input.warnings != null && !Array.isArray(input.warnings)) {
    throw createDocsValidationError(
      'page-review',
      'page-review-warnings-array',
      'Use an array for page review warnings when present.',
      { received: input.warnings },
    );
  }

  return {
    required: input.required,
    sourceType: input.sourceType,
    sourceId: input.sourceId.trim(),
    ...(typeof input.itemId === 'string' ? { itemId: input.itemId } : {}),
    ...(typeof input.sourcePath === 'string' ? { sourcePath: input.sourcePath } : {}),
    ...(typeof input.approvedAt === 'string' ? { approvedAt: input.approvedAt } : {}),
    ...(isRecord(input.metadata) ? { metadata: input.metadata } : {}),
    ...(Array.isArray(input.warnings)
      ? { warnings: input.warnings.map((warning, index) => validateReviewWarning(warning, index)) }
      : {}),
  };
}

export function validateNavigationDoc(input: unknown): NavigationDoc {
  if (!isRecord(input)) {
    throw createDocsValidationError(
      'navigation-doc',
      'navigation-doc-must-be-object',
      'Ensure the navigation file is a JSON object.',
    );
  }

  if (typeof input.version !== 'number') {
    throw createDocsValidationError(
      'navigation-doc',
      'navigation-version-required',
      'Provide a numeric "version" on the navigation document.',
      { received: input.version },
    );
  }

  if (!Array.isArray(input.items)) {
    throw createDocsValidationError(
      'navigation-doc',
      'navigation-items-required',
      'Provide an "items" array on the navigation document.',
      { received: input.items },
    );
  }

  return {
    version: input.version,
    items: input.items.map((item, index) => validateNavItem(item, `items[${index}]`)),
  };
}

export type PageDocValidationOptions = {
  validateContent?: (content: unknown) => void;
};

export function validatePageDoc<TContent = unknown>(
  input: unknown,
  options: PageDocValidationOptions = {},
): PageDoc<TContent> {
  if (!isRecord(input)) {
    throw createDocsValidationError(
      'page-doc',
      'page-doc-must-be-object',
      'Ensure the page document is a JSON object.',
    );
  }

  assertNonEmptyString(input.id, 'page-doc', 'page-id-required', 'Provide a non-empty "id" for the page.');

  if (!isDocsLang(input.lang)) {
    throw createDocsValidationError(
      'page-doc',
      'page-language-invalid',
      'Use a supported docs language such as "en" or "zh".',
      { received: input.lang },
    );
  }

  assertNonEmptyString(input.slug, 'page-doc', 'page-slug-required', 'Provide a non-empty "slug" for the page.');
  assertNonEmptyString(input.title, 'page-doc', 'page-title-required', 'Provide a non-empty "title" for the page.');

  if (input.description != null && typeof input.description !== 'string') {
    throw createDocsValidationError(
      'page-doc',
      'page-description-string',
      'Use a string for "description" when the field is present.',
      { received: input.description },
    );
  }

  if (input.template != null && (typeof input.template !== 'string' || input.template.trim().length === 0)) {
    throw createDocsValidationError(
      'page-doc',
      'page-template-string',
      'Use a non-empty string for "template" when the field is present.',
      { received: input.template },
    );
  }

  if (input.metadata != null && !isRecord(input.metadata)) {
    throw createDocsValidationError(
      'page-doc',
      'page-metadata-object',
      'Use an object for "metadata" when page metadata is present.',
      { received: input.metadata },
    );
  }

  assertOptionalStringArray(
    input.tags,
    'page-doc',
    'page-tags-string-array',
    'Use a string array for "tags" when tags are present.',
  );

  if (!isPageStatus(input.status)) {
    throw createDocsValidationError(
      'page-doc',
      'page-status-invalid',
      'Use one of the supported page statuses: draft, in_review, published.',
      { received: input.status },
    );
  }

  if (input.updatedAt != null && typeof input.updatedAt !== 'string') {
    throw createDocsValidationError(
      'page-doc',
      'page-updated-at-string',
      'Use an ISO 8601 string for "updatedAt" when the field is present.',
      { received: input.updatedAt },
    );
  }

  if (input.render != null) {
    if (!isRecord(input.render)) {
      throw createDocsValidationError(
        'page-doc',
        'page-render-must-be-object',
        'Use an object for "render" when render metadata is present.',
        { received: input.render },
      );
    }

    if (input.render.markdown != null && typeof input.render.markdown !== 'string') {
      throw createDocsValidationError(
        'page-doc',
        'page-render-markdown-string',
        'Use a string for render.markdown when present.',
        { received: input.render.markdown },
      );
    }

    if (input.render.plainText != null && typeof input.render.plainText !== 'string') {
      throw createDocsValidationError(
        'page-doc',
        'page-render-plain-text-string',
        'Use a string for render.plainText when present.',
        { received: input.render.plainText },
      );
    }
  }

  if (!('content' in input)) {
    throw createDocsValidationError(
      'page-doc',
      'page-content-required',
      'Provide a "content" payload for the page document.',
    );
  }

  if (options.validateContent) {
    options.validateContent(input.content);
  }

  if (input.review != null && !isRecord(input.review)) {
    throw createDocsValidationError(
      'page-doc',
      'page-review-object',
      'Use an object for page review metadata when the review field is present.',
      { received: input.review },
    );
  }

  return {
    id: input.id.trim(),
    lang: input.lang,
    slug: input.slug.trim(),
    title: input.title.trim(),
    ...(typeof input.description === 'string' ? { description: input.description } : {}),
    ...(typeof input.template === 'string' ? { template: input.template.trim() } : {}),
    ...(isRecord(input.metadata) ? { metadata: input.metadata } : {}),
    ...(Array.isArray(input.tags) ? { tags: input.tags } : {}),
    status: input.status,
    ...(typeof input.updatedAt === 'string' ? { updatedAt: input.updatedAt } : {}),
    content: input.content as TContent,
    ...(isRecord(input.render) ? { render: input.render } : {}),
    ...(isRecord(input.review) ? { review: validatePageReview(input.review) } : {}),
  };
}
