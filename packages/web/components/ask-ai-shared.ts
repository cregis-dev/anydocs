// Shared helpers and types used by both `<AskAI>` (atlas-docs top-nav button)
// and `<SearchAskPanel>` (classic-docs combined Search + Ask AI panel). The
// two surfaces render different UIs, so styled subcomponents (ClarifyOptions,
// SourceList, etc.) intentionally stay in their respective files. Only the
// truly identical, presentation-free helpers live here.

import {
  formatAskResponseMessage,
  type AskApiCitation,
  type AskApiClarifyOption,
  type AskApiResponse,
} from '@/components/ask-ai-api';

export type AskMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: AskApiCitation[];
  clarifyOptions?: AskApiClarifyOption[];
  clarifyQuestion?: string;
  selectedClarifyScopeId?: string;
};

export function createAskMessage(
  role: AskMessage['role'],
  content: string,
  citations: AskApiCitation[] = [],
): AskMessage {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    role,
    content,
    citations,
  };
}

export function getDocumentationName(
  documentationName: string | undefined,
  isZh: boolean,
): string {
  const name = documentationName?.trim();
  if (name && name.length > 0) {
    return name;
  }
  return isZh ? '当前文档' : 'this documentation';
}

export function getAskDisclaimerText(isZh: boolean): string {
  return isZh
    ? 'Cregis AI 助手仅根据文档提供说明、示例代码和排查建议，不会代表您调用 API 或操作账户。生产使用前请自行审核、测试并确认所有代码与业务逻辑。'
    : 'Cregis AI Assistant only provides documentation-based guidance, code examples, and troubleshooting suggestions. It will not call APIs or operate accounts for you. Review, test, and verify all code and business logic before production use.';
}

export function assistantPayloadFromResponse(
  response: AskApiResponse,
  lang: string,
): Pick<AskMessage, 'content' | 'citations' | 'clarifyOptions'> {
  if (response.type === 'answer') {
    return {
      content: response.answer_md,
      citations: response.citations ?? [],
    };
  }

  if (response.type === 'clarify') {
    return {
      content: response.message,
      citations: [],
      clarifyOptions: response.options ?? [],
    };
  }

  return {
    content: formatAskResponseMessage(response, lang),
    citations: [],
  };
}

export function citationNumber(citation: AskApiCitation, index: number): string {
  return citation.citation_id?.replace(/^cit_/, '') || `${index + 1}`;
}

export function citationPath(citation: AskApiCitation): string {
  const parts =
    citation.breadcrumb
      ?.map((item) => item.title)
      .filter((title) => title && title !== citation.title) ?? [];
  return ['Docs', ...parts].join(' › ');
}
