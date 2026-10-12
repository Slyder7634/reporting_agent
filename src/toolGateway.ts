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
}

const defaultPermissions = JSON.parse(
  fs.readFileSync(path.join(currentDir, 'config', 'permissions.json'), 'utf8')
) as {
  tools: Record<string, boolean>;
  redact: string[];
};

function redactValue(value: unknown, keys: string[]): unknown {
  if (typeof value === 'string') {
    return value;
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
  return Boolean(permissions[toolName]);
}

export function callTool<T>(toolName: string, args: Record<string, unknown>, investigationId: string): { ok: boolean; data?: T; log: ToolCallLog } {
  if (!isToolAllowed(toolName)) {
    return {
      ok: false,
      log: {
        timestamp: new Date().toISOString(),
        tool: toolName,
        arguments: args,
        resultSize: 0,
        investigationId
      }
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
        return { error: 'Unsupported tool' } as T;
    }
  })();

  const safeData = redactSensitiveData(data);
  const resultSize = JSON.stringify(safeData).length;

  return {
    ok: true,
    data: safeData,
    log: {
      timestamp: new Date().toISOString(),
      tool: toolName,
      arguments: args,
      resultSize,
      investigationId
    }
  };
}

export function buildToolSchema() {
  return [
    { name: 'readLogs', description: 'Read redacted application logs for the current report.' },
    { name: 'readState', description: 'Read non-secret app state for the current session or request.' },
    { name: 'runHealthCheck', description: 'Run a read-only health check against the app status.' }
  ];
}
