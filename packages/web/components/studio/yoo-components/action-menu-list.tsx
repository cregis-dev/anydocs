import { ActionMenuList } from "@yoopta/ui";
import type { ActionMenuListRootProps } from "@yoopta/ui/action-menu-list";

type Placement = ActionMenuListRootProps["placement"];

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
