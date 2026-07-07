export function shouldOpenContentLinkInNewTab(href: string | undefined): boolean {
  if (!href) {
    return false;
  }

  const normalizedHref = href.trim();
  return normalizedHref.length > 0 && !normalizedHref.startsWith('#');
}

export function contentLinkTargetProps(href: string | undefined): { target?: '_blank'; rel?: string } {
  return shouldOpenContentLinkInNewTab(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}
