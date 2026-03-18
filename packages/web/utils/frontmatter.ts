type FrontmatterParseResult = {
  data: Record<string, string>;
  content: string;
  hasFrontmatter: boolean;
};

function parseKeyValueLine(line: string) {
  const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
  if (!m) return null;
  const key = m[1];
  const raw = m[2] ?? '';
  const value = raw.replace(/^\s+|\s+$/g, '');
  const unquoted = value
    .replace(/^"(.*)"$/, '$1')
    .replace(/^'(.*)'$/, '$1');
  return { key, value: unquoted };
}

export function parseFrontmatter(text: string): FrontmatterParseResult {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { data: {}, content: text, hasFrontmatter: false };
  }
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) {
    return { data: {}, content: text, hasFrontmatter: false };
  }

  const fmBlock = normalized.slice(4, end);
  const body = normalized.slice(end + '\n---\n'.length);
  const data: Record<string, string> = {};
  for (const line of fmBlock.split('\n')) {
    const kv = parseKeyValueLine(line);
    if (!kv) continue;
    data[kv.key] = kv.value;
  }
  return { data, content: body, hasFrontmatter: true };
}

export function setFrontmatterFields(
  text: string,
  updates: Record<string, string>,
) {
  const parsed = parseFrontmatter(text);
  const nextData = { ...parsed.data, ...updates };
  const lines = Object.entries(nextData)
    .filter(([, v]) => typeof v === 'string')
    .map(([k, v]) => `${k}: ${escapeYamlValue(v)}`);

  const fm = `---\n${lines.join('\n')}\n---\n`;
  if (parsed.hasFrontmatter) {
    const normalized = text.replace(/\r\n/g, '\n');
    const end = normalized.indexOf('\n---\n', 4);
    if (end === -1) return fm + text;
    const body = normalized.slice(end + '\n---\n'.length);
    return fm + body;
  }
  return fm + text;
}

function escapeYamlValue(v: string) {
  const trimmed = v.trim();
  if (!trimmed) return '""';
  if (/[:\n#\-]/.test(trimmed)) {
    return JSON.stringify(trimmed);
  }
  return trimmed;
}
