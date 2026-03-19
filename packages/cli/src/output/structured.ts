import { DomainError } from '@anydocs/core';

type CommandMeta = {
  command: string;
  [key: string]: unknown;
};

type JsonSuccessEnvelope = {
  ok: true;
  data: unknown;
  meta: CommandMeta;
};

type JsonErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
    rule?: string;
    remediation?: string;
    details?: Record<string, unknown>;
  };
  meta: CommandMeta;
};

function writeJson(stream: NodeJS.WriteStream, value: JsonSuccessEnvelope | JsonErrorEnvelope): void {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function writeJsonSuccess(command: string, data: unknown, meta: Record<string, unknown> = {}): void {
  writeJson(process.stdout, {
    ok: true,
    data,
    meta: {
      command,
      ...meta,
    },
  });
}

export function writeJsonError(command: string, caughtError: unknown, meta: Record<string, unknown> = {}): void {
  const fallbackMessage = caughtError instanceof Error ? caughtError.message : String(caughtError);
  const error =
    caughtError instanceof DomainError
      ? {
          code: caughtError.code,
          message: caughtError.message,
          rule: caughtError.details.rule,
          remediation: caughtError.details.remediation,
          details: caughtError.details.metadata,
        }
      : {
          code: 'CLI_ERROR',
          message: fallbackMessage,
        };

  writeJson(process.stderr, {
    ok: false,
    error,
    meta: {
      command,
      ...meta,
    },
  });
}
