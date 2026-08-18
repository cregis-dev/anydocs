import type { ResolvedSchema } from '@anydocs/core';

export type SchemaLabelLang = 'zh' | 'en' | string;

const FRIENDLY_SCHEMA_LABELS: Record<string, { zh: string; en: string }> = {
  PaymentEngineOrderCallbackCommonData: {
    zh: '回调共用字段',
    en: 'Common callback fields',
  },
  PaymentEngineOrderCallbackSettlementData: {
    zh: '支付结算字段',
    en: 'Payment settlement fields',
  },
  PaymentEngineOrderCallbackPaymentData: {
    zh: '支付结果回调字段',
    en: 'Payment result callback fields',
  },
  PaymentEngineOrderCallbackExpiredData: {
    zh: '超时回调字段',
    en: 'Expired callback fields',
  },
  PaymentEngineOrderCallbackRefundedData: {
    zh: '退款回调字段',
    en: 'Refund callback fields',
  },
  PaymentEngineOrderCallbackPaidRemainData: {
    zh: '后续补款回调字段',
    en: 'Remaining payment callback fields',
  },
};

function localizedLabel(labels: { zh: string; en: string }, lang: SchemaLabelLang | undefined): string {
  return lang === 'zh' ? labels.zh : labels.en;
}

export function schemaRefDisplayName(ref: string, options?: { lang?: SchemaLabelLang }): string {
  const friendly = FRIENDLY_SCHEMA_LABELS[ref];
  if (friendly) {
    return localizedLabel(friendly, options?.lang);
  }
  return ref;
}

export function hasFriendlySchemaLabel(ref: string): boolean {
  return Boolean(FRIENDLY_SCHEMA_LABELS[ref]);
}

function isFriendlyCallbackUnion(schema: ResolvedSchema): boolean {
  if (!schema.composition || (schema.composition.kind !== 'oneOf' && schema.composition.kind !== 'anyOf')) {
    return false;
  }
  return schema.composition.members.length > 0 && schema.composition.members.every((member) => member.ref && hasFriendlySchemaLabel(member.ref));
}

function callbackUnionLabel(lang: SchemaLabelLang | undefined): string {
  return lang === 'zh' ? '回调数据对象' : 'Callback data object';
}

/** schema 的简短类型标签（用于参数表、属性行）。 */
export function schemaTypeLabel(schema: ResolvedSchema | undefined, options?: { lang?: SchemaLabelLang }): string {
  if (!schema) {
    return 'any';
  }
  if (schema.ref) {
    return schemaRefDisplayName(schema.ref, options);
  }
  if (isFriendlyCallbackUnion(schema)) {
    return callbackUnionLabel(options?.lang);
  }
  if (schema.composition) {
    const separator = schema.composition.kind === 'allOf' ? ' & ' : ' | ';
    let parts = schema.composition.members.map((member) => schemaTypeLabel(member, options)).filter(Boolean);
    if (schema.composition.kind === 'allOf' && parts.length > 1) {
      parts = parts.filter((part) => part !== 'object');
    }
    if (parts.length > 0) {
      return parts.join(separator);
    }
  }
  if (schema.type === 'array') {
    return `array<${schemaTypeLabel(schema.items, options)}>`;
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

export function formatSchemaDescription(description: string, options?: { lang?: SchemaLabelLang }): string {
  return description.replace(/`?(PaymentEngineOrderCallback[A-Za-z]+Data)`?/g, (_match, ref: string) =>
    schemaRefDisplayName(ref, options),
  );
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
