import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export interface ToolCallLog {
  timestamp: string;
  tool: string;
  arguments: Record<string, unknown>;
  resultSize: number;
  investigationId: string;
  allowed: boolean;
}

export interface ToolCallResult<T = unknown> {
  ok: boolean;
  data?: T;
  log: ToolCallLog;
}

const defaultPermissions = JSON.parse(
  fs.readFileSync(path.join(currentDir, 'config', 'permissions.json'), 'utf8')
) as {
  tools: Record<string, boolean>;
  redact: string[];
};

const auditLog: ToolCallLog[] = [];
const supportedTools = new Set(['readLogs', 'readState', 'runHealthCheck']);

export function redactText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|nvapi-[A-Za-z0-9_-]{12,})\b/gi, '[REDACTED_SECRET]')
    .replace(/\b(api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/(?<!\w)(?:\+?\d[\d\s().-]{8,}\d)(?!\w)/g, '[REDACTED_PHONE]');
}

function redactValue(value: unknown, keys: string[]): unknown {
  if (typeof value === 'string') {
    return redactText(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, keys));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        keys.some((candidate) => key.toLowerCase().includes(candidate.toLowerCase()))
          ? '[REDACTED]'
          : redactValue(nested, keys)
      ])
    );
  }

  return value;
}

export function redactSensitiveData<T>(value: T, keys = defaultPermissions.redact): T {
  return redactValue(value, keys) as T;
}

export function isToolAllowed(toolName: string, permissions = defaultPermissions.tools): boolean {
  return Boolean(permissions[toolName]) && supportedTools.has(toolName);
}

function recordAudit(log: ToolCallLog): void {
  auditLog.push(log);
  if (auditLog.length > 1000) {
    auditLog.shift();
  }
}

export function listAuditLog(): ToolCallLog[] {
  return auditLog.map((entry) => ({ ...entry, arguments: { ...entry.arguments } }));
}

export function callTool<T>(toolName: string, args: Record<string, unknown>, investigationId: string): ToolCallResult<T> {
  const safeArgs = redactSensitiveData(args) as Record<string, unknown>;
  if (!isToolAllowed(toolName)) {
    const log: ToolCallLog = {
      timestamp: new Date().toISOString(),
      tool: toolName,
      arguments: safeArgs,
      resultSize: 0,
      investigationId,
      allowed: false
    };
    recordAudit(log);
    return {
      ok: false,
      log
    };
  }

  const data = (() => {
    switch (toolName) {
      case 'readLogs':
        return {
          logs: ['session expired at 09:13', 'payment request attempted with missing config', 'search offset bug reproduced on page 2'],
          investigationId
        } as T;
      case 'readState':
        return {
          userId: args.userId ?? 'demo-user',
          currentPage: args.page ?? '/checkout',
          paymentConfigured: false,
          searchPage: 2,
          sessionExpired: true
        } as T;
      case 'runHealthCheck':
        return {
          database: 'ok',
          upstream: args.verbose ? 'timeout' : 'healthy',
          configLoaded: false,
          status: 'degraded'
        } as T;
      default:
        return undefined;
    }
  })();

  if (data === undefined) {
    const log: ToolCallLog = {
      timestamp: new Date().toISOString(),
      tool: toolName,
      arguments: safeArgs,
      resultSize: 0,
      investigationId,
      allowed: false
    };
    recordAudit(log);
    return { ok: false, log };
  }

  const safeData = redactSensitiveData(data);
  const resultSize = JSON.stringify(safeData).length;

  const log: ToolCallLog = {
    timestamp: new Date().toISOString(),
    tool: toolName,
    arguments: safeArgs,
    resultSize,
    investigationId,
    allowed: true
  };
  recordAudit(log);

  return {
    ok: true,
    data: safeData,
    log
  };
}

export function buildToolSchema() {
  return [
    {
      name: 'readLogs',
      description: 'Read redacted application logs relevant to a report.',
      parameters: {
        type: 'object',
        properties: { report: { type: 'string', description: 'A short, redacted issue summary.' } },
        required: ['report'],
        additionalProperties: false
      }
    },
    {
      name: 'readState',
      description: 'Read non-secret application state for a page or session.',
      parameters: {
        type: 'object',
        properties: {
          page: { type: 'string' },
          userId: { type: 'string', description: 'Opaque identifier only; omit unless needed.' }
        },
        additionalProperties: false
      }
    },
    {
      name: 'runHealthCheck',
      description: 'Run a read-only application health check.',
      parameters: {
        type: 'object',
        properties: { verbose: { type: 'boolean' } },
        additionalProperties: false
      }
    }
  ];
}
