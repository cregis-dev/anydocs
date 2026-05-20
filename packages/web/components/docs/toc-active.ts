export type TocHeadingCandidate = {
  id: string;
  top: number;
};

export type ResolveActiveTocIdInput = {
  candidates: TocHeadingCandidate[];
  topOffset?: number;
  scrollY: number;
  viewportHeight: number;
  scrollHeight: number;
};

const PAGE_BOTTOM_THRESHOLD_PX = 8;

export function resolveActiveTocId({
  candidates,
  topOffset = 180,
  scrollY,
  viewportHeight,
  scrollHeight,
}: ResolveActiveTocIdInput): string | null {
  if (candidates.length === 0) return null;

  const isAtPageBottom =
    scrollY + viewportHeight >= scrollHeight - PAGE_BOTTOM_THRESHOLD_PX;

  if (isAtPageBottom) {
    return candidates.at(-1)?.id ?? null;
  }

  const visible = candidates.filter((item) => item.top <= topOffset);
  return visible.at(-1)?.id ?? candidates[0]?.id ?? null;
}
