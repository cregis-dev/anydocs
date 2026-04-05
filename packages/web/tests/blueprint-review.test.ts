import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatBlueprintDate,
  formatBlueprintValue,
  getBlueprintDocTypeLabel,
  getBlueprintReviewStateLabel,
  getBlueprintStatusLabel,
  getBlueprintStatusTone,
} from '../lib/themes/blueprint-review.ts';

test('blueprint review helpers localize labels for English and Chinese', () => {
  assert.equal(getBlueprintStatusLabel('published', 'en'), 'Published');
  assert.equal(getBlueprintStatusLabel('in_review', 'zh'), '审核中');

  assert.equal(getBlueprintReviewStateLabel('approved', 'en'), 'Approved');
  assert.equal(getBlueprintReviewStateLabel('blocked', 'zh'), '已阻塞');

  assert.equal(getBlueprintDocTypeLabel('tech-spec', 'en'), 'Tech Spec');
  assert.equal(getBlueprintDocTypeLabel('review-note', 'zh'), '评审记录');
});

test('blueprint review helpers normalize metadata values', () => {
  assert.equal(formatBlueprintValue('  Platform  '), 'Platform');
  assert.equal(formatBlueprintValue([' alice ', '', 'bob']), 'alice, bob');
  assert.equal(formatBlueprintValue(false), 'false');
  assert.equal(formatBlueprintValue(undefined), null);
});

test('blueprint review helpers format dates and tones predictably', () => {
  assert.equal(formatBlueprintDate('2026-04-10', 'en'), 'Apr 10, 2026');
  assert.equal(formatBlueprintDate('2026-04-10', 'zh'), '2026年4月10日');
  assert.equal(formatBlueprintDate('not-a-date', 'en'), 'not-a-date');

  assert.equal(getBlueprintStatusTone('draft'), 'neutral');
  assert.equal(getBlueprintStatusTone('in_review'), 'warning');
  assert.equal(getBlueprintStatusTone('published'), 'success');
});
