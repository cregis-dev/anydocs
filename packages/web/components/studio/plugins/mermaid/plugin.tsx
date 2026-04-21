import { useEffect, useRef, useState } from 'react';
import {
  generateId,
  type PluginElementRenderProps,
  type SlateElement,
  YooptaPlugin,
  useYooptaEditor,
} from '@yoopta/editor';

import { MermaidViewer } from './mermaid-viewer';

// A local edit component for the Mermaid Block
const MermaidElement = (props: PluginElementRenderProps) => {
  const { attributes, children, element, blockId } = props;
  const editor = useYooptaEditor();
  const [isEditing, setIsEditing] = useState(false);
  const mermaidElement = element as SlateElement & { props?: { code?: string } };
  const code = mermaidElement.props?.code || '';
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    editor.updateBlock(blockId, {
      value: [
        {
          ...element,
          props: { ...element.props, code: e.target.value }
        }
      ]
    });
  };

  return (
    <div
      {...attributes}
      className={`relative rounded-md border my-4 transition-all ${
        isEditing ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
      }`}
      contentEditable={false} // Disable Yoopta native typings inside this node
      data-testid="studio-yoopta-mermaid"
    >
      {/* Hidden children to satisfy Slate/Yoopta requirements */}
      <div className="hidden">{children}</div>

      <div className="flex flex-col">
        {/* Render View */}
        <div 
          className="bg-white p-4 cursor-pointer min-h-[100px] flex items-center justify-center"
          onClick={() => setIsEditing(true)}
          title="Click to edit Mermaid syntax"
          data-testid="studio-yoopta-mermaid-toggle"
        >
          {code ? (
            <MermaidViewer code={code} />
          ) : (
            <span className="text-gray-400 text-sm">Click to add Mermaid diagram code...</span>
          )}
        </div>

        {/* Edit View */}
        {isEditing && (
          <div className="border-t border-gray-200 bg-gray-50 p-2">
            <div className="flex justify-between items-center mb-2 px-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">Mermaid Syntax</span>
              <button 
                className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded"
                onClick={() => setIsEditing(false)}
                data-testid="studio-yoopta-mermaid-close"
              >
                Close Editor
              </button>
            </div>
            <textarea
              ref={textareaRef}
              className="w-full h-40 p-3 text-sm font-mono bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
              value={code}
              onChange={handleChange}
              placeholder="graph TD;\n  A-->B;"
              data-testid="studio-yoopta-mermaid-textarea"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const MermaidPlugin = new YooptaPlugin({
  type: 'Mermaid',
  elements: {
    mermaid: {
      render: MermaidElement,
      props: {
        code: '',
      },
    },
  },
  options: {
    display: {
      title: 'Mermaid Diagram',
      description: 'Insert flowchart, sequence, or state diagrams',
    },
    shortcuts: ['/mermaid', '/diagram'],
  },
  parsers: {
    html: {
      deserialize: {
        nodeNames: ['DIV'],
        parse: (el) => {
          if (el.getAttribute('data-yoopta-mermaid')) {
            return {
              id: generateId(),
              type: 'mermaid',
              children: [{ text: '' }],
              props: {
                code: el.getAttribute('data-code') || '',
              },
            };
          }
        },
      },
      serialize: (element, _text, _blockMeta) => {
        const code = element.props?.code || '';
        // In SSR or naive HTML output, we inject a div that can be hydrated or rendered.
        return `<div data-yoopta-mermaid="true" data-code="${encodeURIComponent(code)}" class="mermaid-diagram">${code}</div>`;
      },
    },
    markdown: {
      serialize: (element, _text, _blockMeta) => {
        const code = element.props?.code || '';
        return `\`\`\`mermaid\n${code}\n\`\`\``;
      },
    },
  },
});
