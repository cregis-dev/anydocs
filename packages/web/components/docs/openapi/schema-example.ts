import type { ResolvedSchema } from '@anydocs/core';

type SchemaDict = Record<string, ResolvedSchema>;

function orderedPropertyEntries(
  properties: Record<string, ResolvedSchema>,
  required: readonly string[] | undefined,
): Array<[string, ResolvedSchema]> {
  const requiredSet = new Set(required ?? []);
  const entries = Object.entries(properties);
  return [
    ...entries.filter(([name]) => requiredSet.has(name)),
    ...entries.filter(([name]) => !requiredSet.has(name)),
  ];
}

/**
 * 从 ResolvedSchema 合成一个示例值（用于 operation 页右侧的请求/响应示例）。
 * 优先级：显式 example → 解引用命名 schema → 组合 → 对象/数组递归 → default/enum → 按类型占位。
 * 用 visited 防止命名 schema 循环引用导致无限递归。
 */
export function synthesizeExample(
  schema: ResolvedSchema | undefined,
  schemas: SchemaDict,
  visited: Set<string> = new Set(),
): unknown {
  if (!schema) {
    return null;
  }
  if (schema.example !== undefined) {
    return schema.example;
  }
  if (schema.ref) {
    if (visited.has(schema.ref)) {
      return {};
    }
    const target = schemas[schema.ref];
    if (!target) {
      return {};
    }
    return synthesizeExample(target, schemas, new Set([...visited, schema.ref]));
  }
  if (schema.composition) {
    if (schema.composition.kind === 'allOf') {
      const merged: Record<string, unknown> = {};
      for (const member of schema.composition.members) {
        const part = synthesizeExample(member, schemas, visited);
        if (part && typeof part === 'object' && !Array.isArray(part)) {
          Object.assign(merged, part);
        }
      }
      for (const [key, value] of orderedPropertyEntries(schema.properties ?? {}, schema.required)) {
        merged[key] = synthesizeExample(value, schemas, visited);
      }
      return merged;
    }
    return synthesizeExample(schema.composition.members[0], schemas, visited);
  }
  if (schema.type === 'array') {
    return [synthesizeExample(schema.items, schemas, visited)];
  }
  if (schema.properties && Object.keys(schema.properties).length > 0) {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of orderedPropertyEntries(schema.properties, schema.required)) {
      obj[key] = synthesizeExample(value, schemas, visited);
    }
    return obj;
  }
  if (schema.default !== undefined) {
    return schema.default;
  }
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }
  switch (schema.type) {
    case 'string':
      return schema.format ? `<${schema.format}>` : 'string';
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return true;
    default:
      return schema.type ? `<${schema.type}>` : null;
  }
}
