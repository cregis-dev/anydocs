import assert from 'node:assert/strict';
import test from 'node:test';

import { DOC_READER_ROOT_CLASSNAME } from '../components/docs/doc-reader-classnames.ts';

test('doc reader classnames reset inline code styling inside pre blocks', () => {
  assert.match(DOC_READER_ROOT_CLASSNAME, /\[\&_pre_code\]:bg-transparent/);
  assert.match(DOC_READER_ROOT_CLASSNAME, /\[\&_pre_code\]:rounded-none/);
  assert.match(DOC_READER_ROOT_CLASSNAME, /\[\&_pre_code\]:p-0/);
  assert.match(DOC_READER_ROOT_CLASSNAME, /\[\&_pre_code\]:text-inherit/);
  assert.match(DOC_READER_ROOT_CLASSNAME, /\[\&_pre_code\]:font-inherit/);
});
