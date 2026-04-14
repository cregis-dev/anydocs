export function slugifyHeadingId(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function createHeadingIdGenerator() {
  const seen = new Map<string, number>();

  return (title: string) => {
    const base = slugifyHeadingId(title);
    if (!base) {
      return '';
    }

    const nextCount = (seen.get(base) ?? 0) + 1;
    seen.set(base, nextCount);
    return nextCount === 1 ? base : `${base}-${nextCount}`;
  };
}
