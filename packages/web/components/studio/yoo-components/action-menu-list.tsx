import { ActionMenuList } from "@yoopta/ui";
// @ts-expect-error Yoopta does not re-export the floating-ui placement type we need here.
import type { Placement } from "@floating-ui/dom";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: HTMLElement | null;
  placement?: Placement;
};

export const YooptaActionMenuList = ({
  open,
  onOpenChange,
  anchor,
  placement = "right-start",
}: Props) => {
  return (
    <ActionMenuList
      open={open}
      anchor={anchor}
      onOpenChange={onOpenChange}
      placement={placement}
    >
      <ActionMenuList.Content />
    </ActionMenuList>
  );
};
