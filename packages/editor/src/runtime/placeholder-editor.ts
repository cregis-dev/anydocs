import type { DocContentV1 } from '@anydocs/core';

import type { EditorConfig, EditorInstance } from '../../contract/public-api.ts';
import { EditorNotImplementedError } from './not-implemented-error.ts';

const PLACEHOLDER_MESSAGE =
  'The Plate-backed editor runtime is not implemented yet — see Story 6.2 for the runtime implementation that fulfils @anydocs/editor.';

function notImplemented(method: string): never {
  throw new EditorNotImplementedError(`${PLACEHOLDER_MESSAGE} (called: ${method})`);
}

export function createPlaceholderEditor(_config: EditorConfig): EditorInstance {
  // The config is captured but not used by the placeholder; Story 6.2 will
  // honor `initialContent`, `plugins`, `agentAnchorsEnabled`, and `theme`.
  return {
    mount(_target: HTMLElement) {
      return notImplemented('EditorInstance.mount');
    },
    getContent(): DocContentV1 {
      return notImplemented('EditorInstance.getContent');
    },
    setContent(_payload: DocContentV1): void {
      return notImplemented('EditorInstance.setContent');
    },
    on(
      _event: 'change' | 'selection-change' | 'agent-anchor-triggered',
      _handler: (payload: unknown) => void,
    ) {
      return notImplemented('EditorInstance.on');
    },
    triggerAgent(_scope: 'inline' | 'page' | 'workspace', _payload: unknown) {
      return notImplemented('EditorInstance.triggerAgent');
    },
  };
}
