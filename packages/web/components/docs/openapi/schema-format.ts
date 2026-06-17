import type { ResolvedSchema } from '@anydocs/core';

/** schema 的简短类型标签（用于参数表、属性行）。命名引用直接显示引用名。 */
export function schemaTypeLabel(schema: ResolvedSchema | undefined): string {
  if (!schema) {
    return 'any';
  }
  if (schema.ref) {
    return schema.ref;
  }
  if (schema.composition) {
    const separator = schema.composition.kind === 'allOf' ? ' & ' : ' | ';
    const parts = schema.composition.members.map(schemaTypeLabel).filter(Boolean);
    if (parts.length > 0) {
      return parts.join(separator);
    }
  }
  if (schema.type === 'array') {
    return `array<${schemaTypeLabel(schema.items)}>`;
  }
  if (schema.type) {
    if (schema.contentMediaType === 'application/json') {
      return schema.format ? `${schema.type}<${schema.format}, json>` : `${schema.type}<json>`;
    }
    return schema.format ? `${schema.type}<${schema.format}>` : schema.type;
  }
  if (schema.properties) {
    return 'object';
  }
  if (schema.enum) {
    return 'enum';
  }
  return 'any';
}

/** 把 schema 的示例/默认值格式化为可展示字符串。 */
export function formatExampleValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
