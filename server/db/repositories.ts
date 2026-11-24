import { supabase } from './supabase.js';
import type {
  TransactionRepository,
  AuditRepository,
  TransactionRecord,
  AuditEvent,
} from '../../src/lib/shadow/types.js';

export class SupabaseTransactionRepository implements TransactionRepository {
  async findBySourceAndExternalId(source: string, externalId: string): Promise<TransactionRecord | null> {
    const { data, error } = await supabase
      .from('shadow_transactions')
      .select('*')
      .eq('source', source)
      .eq('external_id', externalId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return this.mapToRecord(data);
  }

  async insert(record: TransactionRecord): Promise<void> {
    const { error } = await supabase.from('shadow_transactions').insert({
      id: record.id,
      source: record.source,
      external_id: record.externalId,
      direction: record.direction,
      amount_minor: record.amountMinor,
      currency: record.currency,
      occurred_at: record.occurredAt,
      counterparty: record.counterparty,
      description: record.description,
      status: record.status,
      received_at: record.receivedAt,
    });

    if (error) {
      if (error.code === '23505') {
        throw new Error('Duplicate source/externalId');
      }
      throw error;
    }
  }

  private mapToRecord(row: any): TransactionRecord {
    return {
      id: row.id,
      source: row.source,
      externalId: row.external_id,
      direction: row.direction,
      amountMinor: Number(row.amount_minor),
      currency: row.currency,
      occurredAt: row.occurred_at,
      counterparty: row.counterparty,
      description: row.description,
      status: row.status,
      receivedAt: row.received_at,
    };
  }
}

export class SupabaseAuditRepository implements AuditRepository {
  async append(event: AuditEvent): Promise<void> {
    const { error } = await supabase.from('shadow_audit_events').insert({
      id: event.id,
      transaction_id: event.transactionId,
      event_type: event.eventType,
      details: event.details,
      occurred_at: event.occurredAt,
    });

    if (error) throw error;
  }
}
