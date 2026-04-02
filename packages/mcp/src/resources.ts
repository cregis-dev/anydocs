import {
  DOCS_YOOPTA_ALLOWED_MARKS,
  DOCS_YOOPTA_ALLOWED_TYPES,
  DOCS_YOOPTA_AUTHORING_GUIDANCE,
  PAGE_TEMPLATE_DEFINITIONS,
  composePageFromTemplate,
} from '@anydocs/core';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import type { Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js';

const JSON_MIME_TYPE = 'application/json';
const MCP_RESOURCE_NOT_FOUND = -32002;

const STATIC_RESOURCES: Resource[] = [
  {
    uri: 'anydocs://authoring/guidance',
    name: 'authoring-guidance',
    title: 'Anydocs Authoring Guidance',
    description: 'Read-only guidance for agent-safe Anydocs authoring workflows and Yoopta usage.',
    mimeType: JSON_MIME_TYPE,
  },
  {
    uri: 'anydocs://templates/index',
    name: 'templates-index',
    title: 'Anydocs Page Templates',
    description: 'Index of built-in rich-content page templates and their recommended inputs.',
    mimeType: JSON_MIME_TYPE,
  },
  {
    uri: 'anydocs://yoopta/allowed-types',
    name: 'yoopta-allowed-types',
    title: 'Allowed Yoopta Types',
    description: 'Supported Anydocs Yoopta block types, marks, and authoring guidance.',
    mimeType: JSON_MIME_TYPE,
  },
];

const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  {
    uriTemplate: 'anydocs://templates/{templateId}',
    name: 'template-detail',
    title: 'Anydocs Template Detail',
    description: 'Canonical detail and example output for a built-in Anydocs page template.',
    mimeType: JSON_MIME_TYPE,
  },
  {
    uriTemplate: 'anydocs://blocks/{blockType}/example',
    name: 'yoopta-block-example',
    title: 'Yoopta Block Example',
    description: 'Canonical minimal example for an allowed Yoopta block type in Anydocs.',
    mimeType: JSON_MIME_TYPE,
  },
];

type TextResourceContents = {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
};

function asJsonResource(uri: string, value: unknown): TextResourceContents {
  return {
    contents: [
      {
        uri,
        mimeType: JSON_MIME_TYPE,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function parseUri(uri: string) {
  return new URL(uri);
}

function createResourceNotFoundError(uri: string, reason: string): McpError {
  return new McpError(MCP_RESOURCE_NOT_FOUND, `Resource not found: ${uri}.`, {
    uri,
    reason,
  });
}

function createTemplateExample(templateId: (typeof PAGE_TEMPLATE_DEFINITIONS)[number]['id']) {
  if (templateId === 'concept') {
    return {
      exampleInput: {
        summary: 'Explain what the feature is, why it exists, and where it fits in the product.',
        sections: [
          {
            title: 'What It Solves',
            body: 'Describe the main user or system problem this concept addresses.',
            items: ['Clarifies the mental model', 'Links the concept to the surrounding workflow'],
          },
          {
            title: 'When To Use It',
            body: 'Explain which situations are a good fit and where another pattern would be better.',
            callout: {
              title: 'Tip',
              body: 'Keep conceptual pages stable and avoid task-by-task procedural detail.',
              theme: 'info',
            },
          },
        ],
      },
      page: composePageFromTemplate({
        template: 'concept',
        summary: 'Explain what the feature is, why it exists, and where it fits in the product.',
        sections: [
          {
            title: 'What It Solves',
            body: 'Describe the main user or system problem this concept addresses.',
            items: ['Clarifies the mental model', 'Links the concept to the surrounding workflow'],
          },
          {
            title: 'When To Use It',
            body: 'Explain which situations are a good fit and where another pattern would be better.',
            callout: {
              title: 'Tip',
              body: 'Keep conceptual pages stable and avoid task-by-task procedural detail.',
              theme: 'info',
            },
          },
        ],
      }),
    };
  }

  if (templateId === 'how_to') {
    return {
      exampleInput: {
        summary: 'Show the shortest correct path to complete a task safely.',
        steps: [
          {
            title: 'Open the project',
            body: 'Call project_open before you decide whether to create or update content.',
          },
          {
            title: 'Create the page from a template',
            body: 'Use page_create_from_template to generate richer first-pass content.',
            code: 'page_create_from_template({ template: "how_to", ... })',
            language: 'typescript',
          },
        ],
        callouts: [
          {
            title: 'Warning',
            body: 'Keep content edits and page status transitions as separate actions.',
            theme: 'warning',
          },
        ],
      },
      page: composePageFromTemplate({
        template: 'how_to',
        summary: 'Show the shortest correct path to complete a task safely.',
        steps: [
          {
            title: 'Open the project',
            body: 'Call project_open before you decide whether to create or update content.',
          },
          {
            title: 'Create the page from a template',
            body: 'Use page_create_from_template to generate richer first-pass content.',
            code: 'page_create_from_template({ template: "how_to", ... })',
            language: 'typescript',
          },
        ],
        callouts: [
          {
            title: 'Warning',
            body: 'Keep content edits and page status transitions as separate actions.',
            theme: 'warning',
          },
        ],
      }),
    };
  }

  return {
    exampleInput: {
      summary: 'Capture stable facts, constraints, and options in a scan-friendly format.',
      sections: [
        {
          title: 'Supported Statuses',
          body: 'List the valid page states and when each one should be used.',
          items: ['draft', 'in_review', 'published'],
        },
        {
          title: 'Operational Notes',
          body: 'Record constraints that authors should remember during maintenance.',
          code: 'page_set_status({ pageId: "guide", status: "published" })',
          language: 'typescript',
        },
      ],
    },
    page: composePageFromTemplate({
      template: 'reference',
      summary: 'Capture stable facts, constraints, and options in a scan-friendly format.',
      sections: [
        {
          title: 'Supported Statuses',
          body: 'List the valid page states and when each one should be used.',
          items: ['draft', 'in_review', 'published'],
        },
        {
          title: 'Operational Notes',
          body: 'Record constraints that authors should remember during maintenance.',
          code: 'page_set_status({ pageId: "guide", status: "published" })',
          language: 'typescript',
        },
      ],
    }),
  };
}

function createBlockExample(blockType: string): Record<string, unknown> {
  const blockId = 'block-1';
  const elementId = 'element-1';
  const meta = { order: 0, depth: 0 };

  switch (blockType) {
    case 'Paragraph':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [{ id: elementId, type: 'paragraph', children: [{ text: 'Body copy' }], props: { nodeType: 'block' } }],
          meta,
        },
      };
    case 'HeadingOne':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [{ id: elementId, type: 'heading-one', children: [{ text: 'Internal Page Heading' }], props: { nodeType: 'block' } }],
          meta,
        },
      };
    case 'HeadingTwo':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [{ id: elementId, type: 'heading-two', children: [{ text: 'Section Title' }], props: { nodeType: 'block' } }],
          meta,
        },
      };
    case 'HeadingThree':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [{ id: elementId, type: 'heading-three', children: [{ text: 'Subsection Title' }], props: { nodeType: 'block' } }],
          meta,
        },
      };
    case 'BulletedList':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [{ id: elementId, type: 'bulleted-list', children: [{ text: 'List item' }], props: { nodeType: 'block' } }],
          meta,
        },
      };
    case 'NumberedList':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [{ id: elementId, type: 'numbered-list', children: [{ text: 'First step' }], props: { nodeType: 'block' } }],
          meta,
        },
      };
    case 'TodoList':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [{ id: elementId, type: 'todo-list', children: [{ text: 'Follow up item' }], props: { nodeType: 'block', checked: false } }],
          meta,
        },
      };
    case 'Blockquote':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [{ id: elementId, type: 'blockquote', children: [{ text: 'Quoted guidance or supporting evidence.' }], props: { nodeType: 'block' } }],
          meta,
        },
      };
    case 'Code':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [{ id: elementId, type: 'code', children: [{ text: 'npx -y @anydocs/mcp' }], props: { nodeType: 'void', language: 'bash' } }],
          meta,
        },
      };
    case 'CodeGroup':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [
            {
              id: elementId,
              type: 'code-group',
              children: [
                { id: 'tab-1', type: 'code', children: [{ text: 'pnpm install' }], props: { language: 'bash', title: 'pnpm', nodeType: 'void' } },
                { id: 'tab-2', type: 'code', children: [{ text: 'npm install' }], props: { language: 'bash', title: 'npm', nodeType: 'void' } },
              ],
              props: { nodeType: 'block' },
            },
          ],
          meta,
        },
      };
    case 'Divider':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [{ id: elementId, type: 'divider', children: [{ text: '' }], props: { nodeType: 'void' } }],
          meta,
        },
      };
    case 'Callout':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [{ id: elementId, type: 'callout', children: [{ text: 'Important note for the reader.' }], props: { nodeType: 'block', theme: 'info' } }],
          meta,
        },
      };
    case 'Image':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [{ id: elementId, type: 'image', children: [{ text: '' }], props: { nodeType: 'void', src: 'https://example.com/image.png', alt: 'Example image' } }],
          meta,
        },
      };
    case 'Table':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [
            {
              id: elementId,
              type: 'table',
              children: [
                {
                  id: 'row-1',
                  type: 'table-row',
                  children: [
                    { id: 'cell-1', type: 'table-cell', children: [{ text: 'Header' }], props: { nodeType: 'block' } },
                    { id: 'cell-2', type: 'table-cell', children: [{ text: 'Value' }], props: { nodeType: 'block' } },
                  ],
                  props: { nodeType: 'block' },
                },
              ],
              props: { nodeType: 'block' },
            },
          ],
          meta,
        },
      };
    case 'Link':
      return {
        [blockId]: {
          id: blockId,
          type: blockType,
          value: [{ id: elementId, type: 'link', children: [{ text: 'Read the full guide' }], props: { nodeType: 'block', href: 'https://example.com/docs' } }],
          meta,
        },
      };
    default:
      throw new Error(`Unsupported block type "${blockType}".`);
  }
}

export function listResourceDefinitions(): Resource[] {
  return STATIC_RESOURCES;
}

export function listResourceTemplateDefinitions(): ResourceTemplate[] {
  return RESOURCE_TEMPLATES;
}

export function listAuthoringResourceReferences() {
  return STATIC_RESOURCES.map((resource) => ({
    uri: resource.uri,
    name: resource.name,
    title: resource.title,
    description: resource.description,
  }));
}

export function listAuthoringResourceTemplateReferences() {
  return RESOURCE_TEMPLATES.map((resourceTemplate) => ({
    uriTemplate: resourceTemplate.uriTemplate,
    name: resourceTemplate.name,
    title: resourceTemplate.title,
    description: resourceTemplate.description,
  }));
}

export function readResource(uri: string): TextResourceContents {
  const parsed = parseUri(uri);
  const host = parsed.host;
  const path = parsed.pathname.replace(/^\/+/, '');

  if (host === 'authoring' && path === 'guidance') {
    return asJsonResource(uri, {
      overview: [
        'Use Anydocs MCP tools as the canonical read/write surface for docs-project authoring.',
        'Treat the root AGENTS.md, CLAUDE.md, or skill.md as a minimal entrypoint; keep the shared template in docs/agent.md and detailed workflow rules here.',
        'Use runtime discovery and project_open.authoring to decide which resources, templates, and examples to read next.',
      ],
      defaultWorkflow: [
        'Start with project_open(projectRoot) before making assumptions about languages, paths, templates, or available resources.',
        'If this is the first MCP interaction in the session or server capability is unclear, inspect listTools, listResources, and listResourceTemplates.',
        'Read project_open.authoring.resources and project_open.authoring.resourceTemplates before guessing resource URIs from memory.',
        'Use project_set_languages only when the user explicitly wants to change the enabled language set.',
        'Use project_validate when project state is uncertain, after structural changes, or before high-impact publish operations.',
        'Read the current state with page_list, page_find, page_get, or nav_get before deciding whether to create, update, delete, or move.',
        'Prefer page_create_from_template for richer first drafts and page_update_from_template when restructuring an existing page into a template.',
        'Use page_create, page_update, page_delete, and page_set_status for normal page maintenance.',
        'When page_update or page_batch_update changes content and the reader-facing render output should stay in sync, pass regenerateRender: true.',
        'Prefer page_batch_create, page_batch_update, and page_batch_set_status when one user request spans multiple pages.',
        'Prefer nav_insert, nav_delete, and nav_move for targeted navigation edits; reserve nav_replace_items or nav_set for explicit whole-tree rewrites.',
        'Re-read every changed page or navigation document after writes, and run project_validate again when the request changed project structure or workflow state.',
      ],
      constraints: [
        'Use MCP tools as the canonical write surface for document-project content.',
        'Always pass projectRoot explicitly, and always pass lang on page operations.',
        'Read the target before writing the target; do not create, overwrite, delete, or move content before confirming the current state.',
        'Treat VALIDATION_ERROR responses as canonical domain feedback; preserve rule and remediation details.',
        'Do not bypass VALIDATION_ERROR responses with direct file edits.',
        'Do not edit pages/<lang>/*.json or navigation/*.json directly unless MCP cannot express the operation.',
        'Use page_set_status for status transitions; do not attempt to change status through page_update.',
      ],
      highImpactOperations: [
        'Treat page_delete, project_set_languages, nav_set, and nav_replace_items as high-impact operations that require explicit user intent.',
        'Before a high-impact operation, read the current state and explain which pages, languages, or navigation paths will be affected.',
        'After a high-impact operation, re-read the affected pages or navigation and validate the project when appropriate.',
      ],
      pageAuthoring: [
        'Use page_find or page_get to confirm whether the page already exists before choosing create versus update.',
        'Prefer structured template inputs over hand-assembling large Yoopta payloads when the page matches concept, how_to, or reference patterns.',
        'Avoid empty content placeholders such as content: {} or content: { blocks: [] } when the user expects a real draft.',
        'Separate content edits from publication steps so workflow errors stay easier to diagnose.',
      ],
      navigation: [
        'Use nav_get before changing navigation so itemPath and parentPath decisions are grounded in the current tree.',
        'Prefer inserting or moving a single item over replacing the full navigation document.',
        'Use slash-separated zero-based item paths such as 0/1/2 for nav_insert, nav_delete, and nav_move.',
      ],
      failureRecovery: [
        'If a tool fails, keep the original error message, especially rule and remediation details from ValidationError envelopes.',
        'Return to project_open or project_validate when project state seems inconsistent or stale.',
        'Use page_get, page_find, or nav_get to confirm that the intended target still exists after a failed write.',
        'Do not work around MCP failures by editing raw source files unless you have first identified a real MCP capability gap.',
      ],
      claudeCommands: [
        {
          name: '/anydocs:new-page',
          purpose: 'Create a new page and optionally place it into navigation through the standard MCP flow.',
        },
        {
          name: '/anydocs:publish-page',
          purpose: 'Publish an existing page through page_set_status with the usual read, validate, and re-read guardrails.',
        },
      ],
      yoopta: {
        allowedBlockTypes: [...DOCS_YOOPTA_ALLOWED_TYPES],
        allowedMarks: [...DOCS_YOOPTA_ALLOWED_MARKS],
        guidance: [...DOCS_YOOPTA_AUTHORING_GUIDANCE],
      },
      templates: PAGE_TEMPLATE_DEFINITIONS.map((template) => ({
        id: template.id,
        label: template.label,
        description: template.description,
        recommendedInputs: [...template.recommendedInputs],
      })),
    });
  }

  if (host === 'templates' && path === 'index') {
    return asJsonResource(uri, {
      templates: PAGE_TEMPLATE_DEFINITIONS.map((template) => ({
        id: template.id,
        label: template.label,
        description: template.description,
        recommendedInputs: [...template.recommendedInputs],
      })),
    });
  }

  if (host === 'yoopta' && path === 'allowed-types') {
    return asJsonResource(uri, {
      allowedBlockTypes: [...DOCS_YOOPTA_ALLOWED_TYPES],
      allowedMarks: [...DOCS_YOOPTA_ALLOWED_MARKS],
      guidance: [...DOCS_YOOPTA_AUTHORING_GUIDANCE],
    });
  }

  if (host === 'templates' && path.length > 0) {
    const definition = PAGE_TEMPLATE_DEFINITIONS.find((template) => template.id === path);
    if (!definition) {
      throw createResourceNotFoundError(uri, 'unknown-template');
    }

    const example = createTemplateExample(definition.id);
    return asJsonResource(uri, {
      template: {
        id: definition.id,
        label: definition.label,
        description: definition.description,
        recommendedInputs: [...definition.recommendedInputs],
      },
      ...example,
    });
  }

  if (host === 'blocks' && path.endsWith('/example')) {
    const blockType = decodeURIComponent(path.slice(0, -'/example'.length));
    if (!DOCS_YOOPTA_ALLOWED_TYPES.includes(blockType as (typeof DOCS_YOOPTA_ALLOWED_TYPES)[number])) {
      throw createResourceNotFoundError(uri, 'unknown-block-example');
    }

    return asJsonResource(uri, {
      blockType,
      exampleContent: createBlockExample(blockType),
      notes: [
        'This is a canonical minimal example for guidance and formatting reference.',
        'Page writes are still validated through the shared authoring service.',
      ],
    });
  }

  throw createResourceNotFoundError(uri, 'unknown-resource');
}
