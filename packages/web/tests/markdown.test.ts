import test from 'node:test';
import assert from 'node:assert/strict';

import { extractTocFromMarkdown, normalizeMarkdownForRendering } from '../lib/docs/markdown.ts';

test('normalizeMarkdownForRendering converts Mintlify card groups into plain markdown bullets', () => {
  const markdown = `
## What is Cregis

<CardGroup cols={2}>
  <Card title="Reliable Security Facilities" icon="palette">
    Multi-party collaborative signature process built on MPC and TEE secure technologies
  </Card>
  <Card title="Flexible Operation and Maintenance Measures" icon="code">
    Enterprise-level approval for payments, organization/member/permission configurations
  </Card>
</CardGroup>
`;

  const normalized = normalizeMarkdownForRendering(markdown);

  assert.ok(normalized.includes('## What is Cregis'));
  assert.ok(normalized.includes('- **Reliable Security Facilities**: Multi-party collaborative signature process built on MPC and TEE secure technologies'));
  assert.ok(normalized.includes('- **Flexible Operation and Maintenance Measures**: Enterprise-level approval for payments, organization/member/permission configurations'));
  assert.equal(normalized.includes('<CardGroup'), false);
  assert.equal(normalized.includes('<Card'), false);
});

test('normalizeMarkdownForRendering converts info blocks and html images into markdown', () => {
  const markdown = `
<Info>
  Note: This document primarily focuses on the first phase.
</Info>

<p align="center">
  <img src="/images/overview01.png" alt="Service Components" width="320" />
</p>
`;

  const normalized = normalizeMarkdownForRendering(markdown);

  assert.ok(normalized.includes('> Note: This document primarily focuses on the first phase.'));
  assert.ok(normalized.includes('![Service Components](/images/overview01.png)'));
  assert.equal(normalized.includes('<Info>'), false);
  assert.equal(normalized.includes('<img'), false);
});

test('extractTocFromMarkdown works with normalized markdown', () => {
  const markdown = normalizeMarkdownForRendering(`
## Overview

<Info>
Extra context
</Info>

### Quick Start
`);

  assert.deepEqual(extractTocFromMarkdown(markdown), [
    { depth: 2, title: 'Overview', id: 'overview' },
    { depth: 3, title: 'Quick Start', id: 'quick-start' },
  ]);
});
