import type { TransactionInput } from './types';

export interface ValidationIssue {
  field: keyof TransactionInput | 'payload';
  message: string;
}

const ISO_CURRENCY = /^[A-Z]{3}$/;

/** Validates shape and safe numeric boundaries; it does not infer tax treatment. */
export function validateTransaction(input: unknown): ValidationIssue[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return [{ field: 'payload', message: 'Expected a transaction object.' }];
  }

  const value = input as Record<string, unknown>;
  const issues: ValidationIssue[] = [];
  const requiredText = ['source', 'externalId', 'currency', 'occurredAt'] as const;

  for (const field of requiredText) {
    if (typeof value[field] !== 'string' || value[field].trim().length === 0) {
      issues.push({ field, message: `${field} is required.` });
    }
  }

  if (value.direction !== 'inbound' && value.direction !== 'outbound') {
    issues.push({ field: 'direction', message: 'direction must be inbound or outbound.' });
  }

  if (typeof value.amountMinor !== 'number' || !Number.isSafeInteger(value.amountMinor) || value.amountMinor <= 0) {
    issues.push({ field: 'amountMinor', message: 'amountMinor must be a positive safe integer in minor currency units.' });
  }

  if (typeof value.currency === 'string' && !ISO_CURRENCY.test(value.currency)) {
    issues.push({ field: 'currency', message: 'currency must be a 3-letter uppercase currency code.' });
  }

  if (typeof value.occurredAt === 'string' && Number.isNaN(Date.parse(value.occurredAt))) {
    issues.push({ field: 'occurredAt', message: 'occurredAt must be a valid date/time.' });
  }

  for (const field of ['counterparty', 'description'] as const) {
    if (value[field] !== undefined && typeof value[field] !== 'string') {
      issues.push({ field, message: `${field} must be text when provided.` });
    }
  }

  return issues;
}
