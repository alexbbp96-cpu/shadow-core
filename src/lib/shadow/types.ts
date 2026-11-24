/** SHADOW CORE 1.0 domain contract. Amounts are integer minor units (e.g. cents/agorot). */
export type TransactionDirection = 'inbound' | 'outbound';
export type TransactionStatus = 'received' | 'needs_review' | 'reviewed' | 'rejected';
export type RiskSeverity = 'info' | 'warning' | 'high';
export type RiskCode = 'MISSING_COUNTERPARTY' | 'DUPLICATE_EXTERNAL_ID' | 'FUTURE_DATED' | 'LARGE_AMOUNT' | 'UNSUPPORTED_CURRENCY';

export interface TransactionInput {
  source: string;
  externalId: string;
  direction: TransactionDirection;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  counterparty?: string;
  description?: string;
}

export interface TransactionRecord extends TransactionInput {
  id: string;
  status: TransactionStatus;
  receivedAt: string;
}

export interface RiskFlag {
  code: RiskCode;
  severity: RiskSeverity;
  message: string;
}

export interface MonitoringResult {
  transaction: TransactionRecord;
  flags: RiskFlag[];
  requiresHumanReview: boolean;
}

export interface MonitorPolicy {
  largeAmountThresholdMinor?: number;
  supportedCurrencies: readonly string[];
  now?: () => Date;
}

export interface TransactionRepository {
  findBySourceAndExternalId(source: string, externalId: string): Promise<TransactionRecord | null>;
  /** Must enforce UNIQUE(source, external_id) to prevent concurrent duplicate inserts. */
  insert(record: TransactionRecord): Promise<void>;
}

export interface AuditEvent {
  id: string;
  transactionId: string;
  eventType: 'TRANSACTION_RECEIVED' | 'RISK_FLAGGED' | 'STATUS_CHANGED';
  details: Record<string, string | number | boolean | null>;
  occurredAt: string;
}

export interface AuditRepository {
  append(event: AuditEvent): Promise<void>;
}
