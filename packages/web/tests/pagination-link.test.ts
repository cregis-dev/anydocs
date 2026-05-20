import assert from "node:assert/strict";
import test from "node:test";

import { shouldScrollPaginationLink } from "../components/docs/pagination-link-click.ts";

const plainClick = {
  button: 0,
  defaultPrevented: false,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
};

test("shouldScrollPaginationLink handles plain left clicks", () => {
  assert.equal(shouldScrollPaginationLink(plainClick), true);
});

test("shouldScrollPaginationLink ignores modified clicks", () => {
  assert.equal(shouldScrollPaginationLink({ ...plainClick, button: 1 }), false);
  assert.equal(shouldScrollPaginationLink({ ...plainClick, defaultPrevented: true }), false);
  assert.equal(shouldScrollPaginationLink({ ...plainClick, metaKey: true }), false);
  assert.equal(shouldScrollPaginationLink({ ...plainClick, ctrlKey: true }), false);
  assert.equal(shouldScrollPaginationLink({ ...plainClick, shiftKey: true }), false);
  assert.equal(shouldScrollPaginationLink({ ...plainClick, altKey: true }), false);
});
