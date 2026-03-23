import type { YooptaContentValue } from '@yoopta/editor';

export {
  DOCS_YOOPTA_ALLOWED_MARKS,
  DOCS_YOOPTA_ALLOWED_TYPES,
  DOCS_YOOPTA_AUTHORING_GUIDANCE,
  validateYooptaContentValue,
} from '@anydocs/core';

import { assertValidYooptaContentValue as assertValidYooptaContentValueFromCore } from '@anydocs/core';

export type { YooptaContentValue };

export function assertValidYooptaContentValue(value: unknown): asserts value is YooptaContentValue {
  assertValidYooptaContentValueFromCore(value);
}
