import type { DocContentV1 } from '../types/content.ts';
import type { PageRender } from '../types/docs.ts';
import { validateDocContentV1 } from './content-schema.ts';
import { renderDocContent } from './canonical-render.ts';
import { renderYooptaContent } from './yoopta-render.ts';

export function renderPageContent(value: unknown): PageRender {
  const canonical = validateDocContentV1(value);
  if (canonical.ok) {
    return renderDocContent(value as DocContentV1);
  }

  return renderYooptaContent(value);
}
