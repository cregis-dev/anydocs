import { useRef, useState } from "react";
import { GripVertical, PlusIcon } from "lucide-react";
import { Blocks, useYooptaEditor } from "@yoopta/editor";
import { FloatingBlockActions } from "@yoopta/ui";
import { DragHandle } from "@yoopta/ui/block-dnd";

import { YooptaBlockOptions } from "./block-options";

export const YooptaFloatingBlockActions = () => {
  const editor = useYooptaEditor();
  const dragHandleRef = useRef<HTMLButtonElement>(null);
  const [blockOptionsOpen, setBlockOptionsOpen] = useState(false);
  const [dragHandleAnchor, setDragHandleAnchor] =
    useState<HTMLButtonElement | null>(null);

  const handleDragHandleRef = (node: HTMLButtonElement | null) => {
    dragHandleRef.current = node;
    setDragHandleAnchor(node);
  };

  const onPlusClick = (blockId: string | null) => {
    if (!blockId) return;
    const floatingBlock = Blocks.getBlock(editor, { id: blockId });
    if (!floatingBlock) return;

    const nextOrder = floatingBlock.meta.order + 1;
    editor.insertBlock("Paragraph", { at: nextOrder, focus: true });
  };

  const onDragClick = (blockId: string | null) => {
    if (!blockId) return;
    const block = Blocks.getBlock(editor, { id: blockId });
    if (!block) return;
    editor.setPath({ current: block.meta.order });
    setBlockOptionsOpen(true);
  };

  const onBlockOptionsChange = (open: boolean) => {
    setBlockOptionsOpen(open);
  };

  return (
    <FloatingBlockActions frozen={blockOptionsOpen}>
      {({ blockId }: { blockId: string }) => (
        <>
          <FloatingBlockActions.Button
            onClick={() => onPlusClick(blockId)}
            title="Add block"
            aria-label="Add paragraph block"
            data-testid="studio-yoopta-add-block-button"
          >
            <PlusIcon />
          </FloatingBlockActions.Button>
          <DragHandle blockId={blockId} ref={handleDragHandleRef} asChild>
            <FloatingBlockActions.Button
              onClick={() => onDragClick(blockId)}
              title="Drag to reorder, or click for block options"
              aria-label="Drag to reorder or open block options"
              data-testid="studio-yoopta-drag-block-button"
            >
              <GripVertical />
            </FloatingBlockActions.Button>
          </DragHandle>

          <YooptaBlockOptions
            open={blockOptionsOpen}
            onOpenChange={onBlockOptionsChange}
            blockId={blockId}
            anchor={dragHandleAnchor}
          />
        </>
      )}
    </FloatingBlockActions>
  );
};
