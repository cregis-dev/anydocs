import { ValidationError } from '../errors/validation-error.ts';
export {
  findResolvedProjectPageTemplate,
  listResolvedProjectPageTemplates,
  PAGE_TEMPLATE_DEFINITIONS,
  PAGE_TEMPLATE_KINDS,
  type PageTemplateKind,
  type ResolvedProjectPageTemplateDefinition,
} from '../templates/page-template-definitions.ts';
import {
  findResolvedProjectPageTemplate,
  PAGE_TEMPLATE_DEFINITIONS,
  PAGE_TEMPLATE_KINDS,
  type PageTemplateKind,
} from '../templates/page-template-definitions.ts';
import type { DocsLang, PageStatus, PageReview } from '../types/docs.ts';
import type {
  PageDoc,
} from '../types/docs.ts';
import type {
  ProjectConfig,
  ProjectPageTemplateDefinition,
  ProjectPageTemplateMetadataField,
} from '../types/project.ts';
import type { AuthoringPageResult, CreatePageInput, UpdatePagePatch } from './authoring-service.ts';
import { createPage, updatePage } from './authoring-service.ts';

export type PageTemplateCalloutTheme = 'info' | 'warning' | 'success';

export type PageTemplateCalloutInput = {
  title?: string;
  body: string;
  theme?: PageTemplateCalloutTheme;
};

export type PageTemplateSectionInput = {
  title: string;
  body?: string;
  items?: string[];
  code?: string;
  language?: string;
  callout?: PageTemplateCalloutInput;
};

export type PageTemplateStepInput = {
  title: string;
  body?: string;
  code?: string;
  language?: string;
};

export type CreatePageFromTemplateInput = {
  projectRoot: string;
  lang: DocsLang;
  page: {
    id: string;
    slug: string;
    title: string;
    description?: string;
    tags?: string[];
    status?: PageStatus;
    review?: PageReview;
  };
  template: PageTemplateKind;
  summary?: string;
  sections?: PageTemplateSectionInput[];
  steps?: PageTemplateStepInput[];
  callouts?: PageTemplateCalloutInput[];
};

export type UpdatePageFromTemplateInput = {
  projectRoot: string;
  lang: DocsLang;
  pageId: string;
  patch?: Pick<UpdatePagePatch<Record<string, unknown>>, 'slug' | 'title' | 'description' | 'tags' | 'review'>;
  template: PageTemplateKind;
  summary?: string;
  sections?: PageTemplateSectionInput[];
  steps?: PageTemplateStepInput[];
  callouts?: PageTemplateCalloutInput[];
};

type PageTemplateComposition = {
  content: Record<string, unknown>;
  render: {
    markdown: string;
    plainText: string;
  };
};

function normalizeText(value: string | undefined, key: string): string | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`Template field "${key}" must be a string.`, {
      entity: 'page-template',
      rule: 'page-template-string-field',
      remediation: `Provide "${key}" as a string or omit it.`,
      metadata: { key, received: value },
    });
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createProjectPageValidationError(
  rule: string,
  remediation: string,
  metadata?: Record<string, unknown>,
): ValidationError {
  return new ValidationError(`Page authoring contract validation failed for rule "${rule}".`, {
    entity: 'page-doc',
    rule,
    remediation,
    metadata,
  });
}

function normalizeMetadataFieldValue(
  field: ProjectPageTemplateMetadataField,
  value: unknown,
  pageMetadata: Record<string, unknown>,
): unknown {
  if (value == null) {
    return undefined;
  }

  switch (field.type) {
    case 'string':
    case 'text': {
      if (typeof value !== 'string') {
        throw createProjectPageValidationError(
          'page-template-metadata-field-type',
          `Use a string for metadata field "${field.id}".`,
          { fieldId: field.id, fieldType: field.type, received: value, metadata: pageMetadata },
        );
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    case 'enum': {
      if (typeof value !== 'string') {
        throw createProjectPageValidationError(
          'page-template-metadata-field-type',
          `Use a string option id for enum metadata field "${field.id}".`,
          { fieldId: field.id, fieldType: field.type, received: value, metadata: pageMetadata },
        );
      }
      const trimmed = value.trim();
      if (!field.options?.includes(trimmed)) {
        throw createProjectPageValidationError(
          'page-template-metadata-field-option-known',
          `Use one of the configured option ids for enum metadata field "${field.id}".`,
          { fieldId: field.id, options: field.options ?? [], received: value, metadata: pageMetadata },
        );
      }
      return trimmed;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        throw createProjectPageValidationError(
          'page-template-metadata-field-type',
          `Use a boolean for metadata field "${field.id}".`,
          { fieldId: field.id, fieldType: field.type, received: value, metadata: pageMetadata },
        );
      }
      return value;
    }
    case 'date': {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        throw createProjectPageValidationError(
          'page-template-metadata-field-date-format',
          `Use "YYYY-MM-DD" for date metadata field "${field.id}".`,
          { fieldId: field.id, received: value, metadata: pageMetadata },
        );
      }
      return value.trim();
    }
    case 'string[]': {
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw createProjectPageValidationError(
          'page-template-metadata-field-type',
          `Use an array of strings for metadata field "${field.id}".`,
          { fieldId: field.id, fieldType: field.type, received: value, metadata: pageMetadata },
        );
      }
      const normalized = value.map((item) => item.trim()).filter(Boolean);
      return [...new Set(normalized)];
    }
    default:
      return value;
  }
}

export function validatePageAgainstProjectTemplates<TContent = unknown>(
  page: PageDoc<TContent>,
  config: ProjectConfig,
): PageDoc<TContent> {
  const templateId = page.template?.trim();
  const metadata = page.metadata;

  if (metadata && !templateId) {
    throw createProjectPageValidationError(
      'page-metadata-requires-template',
      'Set "template" before storing page metadata.',
      { pageId: page.id, lang: page.lang },
    );
  }

  if (!templateId) {
    return page;
  }

  const resolvedTemplate = findResolvedProjectPageTemplate(config, templateId);
  if (!resolvedTemplate) {
    throw createProjectPageValidationError(
      'page-template-must-exist',
      'Use a built-in template id or define the custom template in anydocs.config.json.',
      { pageId: page.id, lang: page.lang, templateId },
    );
  }

  const metadataFields = resolvedTemplate.metadataSchema?.fields ?? [];
  if (metadataFields.length === 0) {
    if (metadata) {
      throw createProjectPageValidationError(
        'page-template-metadata-not-allowed',
        'Omit "metadata" when the selected template does not define metadata fields.',
        { pageId: page.id, lang: page.lang, templateId },
      );
    }

    return {
      ...page,
      template: templateId,
    };
  }

  if (metadata != null && !isRecord(metadata)) {
    throw createProjectPageValidationError(
      'page-template-metadata-object',
      'Use an object for page metadata when the selected template defines metadata fields.',
      { pageId: page.id, lang: page.lang, templateId, received: metadata },
    );
  }

  const rawMetadata = metadata ?? {};
  const knownFieldIds = new Set(metadataFields.map((field) => field.id));
  for (const key of Object.keys(rawMetadata)) {
    if (!knownFieldIds.has(key)) {
      throw createProjectPageValidationError(
        'page-template-metadata-field-known',
        'Use only metadata fields defined by the selected template.',
        { pageId: page.id, lang: page.lang, templateId, fieldId: key },
      );
    }
  }

  const normalizedMetadata: Record<string, unknown> = {};
  for (const field of metadataFields) {
    const normalizedValue = normalizeMetadataFieldValue(field, rawMetadata[field.id], rawMetadata);
    const isMissing =
      normalizedValue == null || (Array.isArray(normalizedValue) && normalizedValue.length === 0);

    if (field.required && isMissing) {
      throw createProjectPageValidationError(
        'page-template-metadata-field-required',
        `Provide a value for required metadata field "${field.id}".`,
        { pageId: page.id, lang: page.lang, templateId, fieldId: field.id },
      );
    }

    if (!isMissing) {
      normalizedMetadata[field.id] = normalizedValue;
    }
  }

  return {
    ...page,
    template: templateId,
    ...(Object.keys(normalizedMetadata).length > 0 ? { metadata: normalizedMetadata } : {}),
  };
}

export function filterPublicPageMetadata<TContent = unknown>(
  page: PageDoc<TContent>,
  config: ProjectConfig,
): Record<string, unknown> | undefined {
  if (!page.template || !page.metadata) {
    return undefined;
  }

  const resolvedTemplate = findResolvedProjectPageTemplate(config, page.template);
  if (!resolvedTemplate?.metadataSchema?.fields?.length) {
    return undefined;
  }

  const publicMetadataEntries = resolvedTemplate.metadataSchema.fields
    .filter(
      (field) =>
        field.visibility === 'public' && Object.prototype.hasOwnProperty.call(page.metadata ?? {}, field.id),
    )
    .map((field) => [field.id, page.metadata?.[field.id]] as const)
    .filter((entry) => entry[1] != null);

  if (publicMetadataEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(publicMetadataEntries);
}

function normalizeStringList(values: string[] | undefined, key: string): string[] {
  if (values == null) {
    return [];
  }

  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) {
    throw new ValidationError(`Template field "${key}" must be a string array.`, {
      entity: 'page-template',
      rule: 'page-template-string-array-field',
      remediation: `Provide "${key}" as an array of non-empty strings.`,
      metadata: { key, received: values },
    });
  }

  return values.map((value) => value.trim()).filter(Boolean);
}

function normalizeCallout(value: PageTemplateCalloutInput, key: string): PageTemplateCalloutInput {
  const body = normalizeText(value.body, `${key}.body`);
  if (!body) {
    throw new ValidationError(`Template callout "${key}" must include body text.`, {
      entity: 'page-template',
      rule: 'page-template-callout-body-required',
      remediation: 'Provide a non-empty callout body.',
      metadata: { key },
    });
  }

  return {
    body,
    ...(normalizeText(value.title, `${key}.title`) ? { title: normalizeText(value.title, `${key}.title`) } : {}),
    ...(value.theme ? { theme: value.theme } : {}),
  };
}

function normalizeSections(sections: PageTemplateSectionInput[] | undefined): PageTemplateSectionInput[] {
  if (sections == null) {
    return [];
  }

  if (!Array.isArray(sections)) {
    throw new ValidationError('Template field "sections" must be an array.', {
      entity: 'page-template',
      rule: 'page-template-sections-array',
      remediation: 'Provide "sections" as an array of structured section objects.',
      metadata: { received: sections },
    });
  }

  return sections.map((section, index) => {
    const title = normalizeText(section.title, `sections[${index}].title`);
    const body = normalizeText(section.body, `sections[${index}].body`);
    const items = normalizeStringList(section.items, `sections[${index}].items`);
    const code = normalizeText(section.code, `sections[${index}].code`);
    const language = normalizeText(section.language, `sections[${index}].language`);
    const callout = section.callout ? normalizeCallout(section.callout, `sections[${index}].callout`) : undefined;

    if (!title) {
      throw new ValidationError(`Template section ${index + 1} must include a title.`, {
        entity: 'page-template',
        rule: 'page-template-section-title-required',
        remediation: 'Provide a non-empty section title.',
        metadata: { index },
      });
    }

    if (!body && items.length === 0 && !code && !callout) {
      throw new ValidationError(`Template section "${title}" has no content.`, {
        entity: 'page-template',
        rule: 'page-template-section-content-required',
        remediation: 'Provide body, items, code, or a callout for each section.',
        metadata: { index, title },
      });
    }

    return {
      title,
      ...(body ? { body } : {}),
      ...(items.length > 0 ? { items } : {}),
      ...(code ? { code } : {}),
      ...(language ? { language } : {}),
      ...(callout ? { callout } : {}),
    };
  });
}

function normalizeSteps(steps: PageTemplateStepInput[] | undefined): PageTemplateStepInput[] {
  if (steps == null) {
    return [];
  }

  if (!Array.isArray(steps)) {
    throw new ValidationError('Template field "steps" must be an array.', {
      entity: 'page-template',
      rule: 'page-template-steps-array',
      remediation: 'Provide "steps" as an array of structured step objects.',
      metadata: { received: steps },
    });
  }

  return steps.map((step, index) => {
    const title = normalizeText(step.title, `steps[${index}].title`);
    const body = normalizeText(step.body, `steps[${index}].body`);
    const code = normalizeText(step.code, `steps[${index}].code`);
    const language = normalizeText(step.language, `steps[${index}].language`);

    if (!title) {
      throw new ValidationError(`Template step ${index + 1} must include a title.`, {
        entity: 'page-template',
        rule: 'page-template-step-title-required',
        remediation: 'Provide a non-empty step title.',
        metadata: { index },
      });
    }

    if (!body && !code) {
      throw new ValidationError(`Template step "${title}" has no content.`, {
        entity: 'page-template',
        rule: 'page-template-step-content-required',
        remediation: 'Provide step body text or code.',
        metadata: { index, title },
      });
    }

    return {
      title,
      ...(body ? { body } : {}),
      ...(code ? { code } : {}),
      ...(language ? { language } : {}),
    };
  });
}

class YooptaTemplateBuilder {
  private readonly content: Record<string, unknown> = {};
  private readonly markdownBlocks: string[] = [];
  private readonly plainTextBlocks: string[] = [];
  private blockOrder = 0;
  private idCounter = 1;

  paragraph(text: string): void {
    const normalized = text.trim();
    if (!normalized) return;
    this.pushBlock('Paragraph', 'paragraph', [{ text: normalized }], { nodeType: 'block' });
    this.markdownBlocks.push(normalized);
    this.plainTextBlocks.push(normalized);
  }

  heading(level: 2 | 3, text: string): void {
    const normalized = text.trim();
    if (!normalized) return;
    const type = level === 2 ? 'HeadingTwo' : 'HeadingThree';
    const elementType = level === 2 ? 'heading-two' : 'heading-three';
    this.pushBlock(type, elementType, [{ text: normalized }], { nodeType: 'block' });
    this.markdownBlocks.push(`${'#'.repeat(level)} ${normalized}`);
    this.plainTextBlocks.push(normalized);
  }

  bulletedList(items: string[]): void {
    for (const item of items.map((value) => value.trim()).filter(Boolean)) {
      this.pushBlock('BulletedList', 'bulleted-list', [{ text: item }], { nodeType: 'block' });
      this.markdownBlocks.push(`- ${item}`);
      this.plainTextBlocks.push(item);
    }
  }

  numberedList(items: string[]): void {
    items
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((item, index) => {
        this.pushBlock('NumberedList', 'numbered-list', [{ text: item }], { nodeType: 'block' });
        this.markdownBlocks.push(`${index + 1}. ${item}`);
        this.plainTextBlocks.push(item);
      });
  }

  code(code: string, language?: string): void {
    const normalized = code.trim();
    if (!normalized) return;
    this.pushBlock('Code', 'code', [{ text: normalized }], {
      nodeType: 'void',
      ...(language ? { language } : {}),
    });
    this.markdownBlocks.push(`\`\`\`${language ?? ''}\n${normalized}\n\`\`\``);
    this.plainTextBlocks.push(normalized);
  }

  callout(callout: PageTemplateCalloutInput): void {
    const parts = [callout.title?.trim(), callout.body.trim()].filter(Boolean);
    const text = parts.join(': ');
    if (!text) return;
    this.pushBlock('Callout', 'callout', [{ text }], {
      nodeType: 'block',
      theme: callout.theme ?? 'info',
    });
    this.markdownBlocks.push(`> ${text}`);
    this.plainTextBlocks.push(text);
  }

  build(): PageTemplateComposition {
    return {
      content: this.content,
      render: {
        markdown: this.markdownBlocks.join('\n\n'),
        plainText: this.plainTextBlocks.join('\n\n'),
      },
    };
  }

  private nextId(prefix: string): string {
    const value = `${prefix}-${this.idCounter}`;
    this.idCounter += 1;
    return value;
  }

  private pushBlock(
    type: string,
    elementType: string,
    children: Array<Record<string, unknown>>,
    props: Record<string, unknown>,
  ): void {
    const blockId = this.nextId('block');
    const elementId = this.nextId('element');
    this.content[blockId] = {
      id: blockId,
      type,
      value: [
        {
          id: elementId,
          type: elementType,
          children,
          props,
        },
      ],
      meta: { order: this.blockOrder, depth: 0 },
    };
    this.blockOrder += 1;
  }
}

export function composePageFromTemplate(input: Omit<CreatePageFromTemplateInput, 'projectRoot' | 'lang' | 'page'>): PageTemplateComposition {
  const summary = normalizeText(input.summary, 'summary');
  const sections = normalizeSections(input.sections);
  const steps = normalizeSteps(input.steps);
  const callouts = (input.callouts ?? []).map((callout, index) => normalizeCallout(callout, `callouts[${index}]`));

  if (input.template === 'how_to' && steps.length === 0) {
    throw new ValidationError('Template "how_to" requires at least one step.', {
      entity: 'page-template',
      rule: 'page-template-how-to-steps-required',
      remediation: 'Provide at least one structured step when using the "how_to" template.',
      metadata: { template: input.template },
    });
  }

  if (!summary && sections.length === 0 && steps.length === 0 && callouts.length === 0) {
    throw new ValidationError(`Template "${input.template}" has no content to compose.`, {
      entity: 'page-template',
      rule: 'page-template-content-required',
      remediation: 'Provide summary, sections, steps, or callouts when creating a templated page.',
      metadata: { template: input.template },
    });
  }

  const builder = new YooptaTemplateBuilder();

  if (summary) {
    builder.paragraph(summary);
  }

  if (input.template === 'how_to' && steps.length > 0) {
    builder.heading(2, 'Steps');
    builder.numberedList(steps.map((step) => step.title));
    for (const step of steps) {
      builder.heading(3, step.title);
      if (step.body) builder.paragraph(step.body);
      if (step.code) builder.code(step.code, step.language);
    }
  }

  for (const section of sections) {
    builder.heading(2, section.title);
    if (section.body) builder.paragraph(section.body);
    if (section.items) builder.bulletedList(section.items);
    if (section.code) builder.code(section.code, section.language);
    if (section.callout) builder.callout(section.callout);
  }

  for (const callout of callouts) {
    builder.callout(callout);
  }

  return builder.build();
}

export async function createPageFromTemplate(
  input: CreatePageFromTemplateInput,
): Promise<AuthoringPageResult<Record<string, unknown>>> {
  const composition = composePageFromTemplate({
    template: input.template,
    summary: input.summary,
    sections: input.sections,
    steps: input.steps,
    callouts: input.callouts,
  });

  return createPage({
    projectRoot: input.projectRoot,
    lang: input.lang,
    page: {
      ...input.page,
      content: composition.content,
      render: composition.render,
    },
  } satisfies CreatePageInput<Record<string, unknown>>);
}

export async function updatePageFromTemplate(
  input: UpdatePageFromTemplateInput,
): Promise<AuthoringPageResult<Record<string, unknown>>> {
  const composition = composePageFromTemplate({
    template: input.template,
    summary: input.summary,
    sections: input.sections,
    steps: input.steps,
    callouts: input.callouts,
  });

  return updatePage({
    projectRoot: input.projectRoot,
    lang: input.lang,
    pageId: input.pageId,
    patch: {
      ...(input.patch ?? {}),
      content: composition.content,
      render: composition.render,
    },
  });
}
