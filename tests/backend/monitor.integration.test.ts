import { describe, it, expect, beforeEach } from 'vitest';
import { monitorTransaction, ShadowValidationError, ShadowDuplicateError } from '../../src/lib/shadow/monitor.js';
import type { TransactionRepository, AuditRepository, TransactionRecord, AuditEvent } from '../../src/lib/shadow/types.js';

class InMemoryTxRepo implements TransactionRepository {
  private store = new Map<string, TransactionRecord>();
  async findBySourceAndExternalId(source: string, externalId: string) {
    return this.store.get(`${source}:${externalId}`) ?? null;
  }
  async insert(record: TransactionRecord) {
    this.store.set(`${record.source}:${record.externalId}`, record);
  }
}

class InMemoryAudit implements AuditRepository {
  events: AuditEvent[] = [];
  async append(event: AuditEvent) {
    this.events.push(event);
  }
}

describe('SHADOW monitor (backend integration style)', () => {
  let txRepo: InMemoryTxRepo;
  let audit: InMemoryAudit;
  const policy = {
    supportedCurrencies: ['ILS', 'USD'],
    largeAmountThresholdMinor: 100000,
    now: () => new Date('2026-11-24T12:00:00Z'),
  };

  beforeEach(() => {
    txRepo = new InMemoryTxRepo();
    audit = new InMemoryAudit();
  });

  it('accepts valid transaction', async () => {
    const result = await monitorTransaction(
      {
        source: 'test',
        externalId: '001',
        direction: 'inbound',
        amountMinor: 5000,
        currency: 'ILS',
        occurredAt: '2026-11-24T11:00:00Z',
        counterparty: 'OK',
      },
      { transactions: txRepo, audit, policy }
    );
    expect(result.transaction.status).toBe('received');
    expect(result.flags).toHaveLength(0);
  });

  it('rejects invalid input', async () => {
    await expect(
      monitorTransaction(
        { source: '', externalId: 'x', direction: 'inbound', amountMinor: 100, currency: 'ILS', occurredAt: '2026-11-24T11:00:00Z' },
        { transactions: txRepo, audit, policy }
      )
    ).rejects.toBeInstanceOf(ShadowValidationError);
  });

  it('rejects duplicate', async () => {
    const input = {
      source: 'test',
      externalId: 'dup',
      direction: 'inbound' as const,
      amountMinor: 1000,
      currency: 'ILS',
      occurredAt: '2026-11-24T11:00:00Z',
    };
    await monitorTransaction(input, { transactions: txRepo, audit, policy });
    await expect(monitorTransaction(input, { transactions: txRepo, audit, policy })).rejects.toBeInstanceOf(ShadowDuplicateError);
  });

  it('flags missing counterparty and large amount', async () => {
    const result = await monitorTransaction(
      {
        source: 'test',
        externalId: 'flag',
        direction: 'outbound',
        amountMinor: 150000,
        currency: 'ILS',
        occurredAt: '2026-11-24T11:00:00Z',
      },
      { transactions: txRepo, audit, policy }
    );
    expect(result.requiresHumanReview).toBe(true);
    expect(result.flags.map(f => f.code)).toEqual(expect.arrayContaining(['MISSING_COUNTERPARTY', 'LARGE_AMOUNT']));
  });
});
