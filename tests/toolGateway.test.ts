import { describe, expect, it } from 'vitest';

import { callTool, listAuditLog, redactSensitiveData } from '../src/toolGateway.js';

describe('tool gateway safeguards', () => {
  it('redacts sensitive values in structured fields and free text', () => {
    const redacted = redactSensitiveData({
      userId: 'opaque-user-123',
      note: 'Contact person@example.com or use Bearer abc123token'
    });

    expect(redacted).toEqual({
      userId: '[REDACTED]',
      note: 'Contact [REDACTED_EMAIL] or use Bearer [REDACTED]'
    });
  });

  it('rejects tools outside the allowlist and records a redacted audit entry', () => {
    const result = callTool('executeShell', { token: 'top-secret' }, 'INV-TEST');
    const entry = listAuditLog().at(-1);

    expect(result.ok).toBe(false);
    expect(result.log.allowed).toBe(false);
    expect(entry?.tool).toBe('executeShell');
    expect(entry?.arguments).toEqual({ token: '[REDACTED]' });
  });
});
