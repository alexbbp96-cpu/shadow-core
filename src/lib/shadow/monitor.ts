import type {
  AuditRepository,
  MonitorPolicy,
  MonitoringResult,
  RiskFlag,
  TransactionInput,
  TransactionRecord,
  TransactionRepository,
} from './types';
import { validateTransaction } from './validation';

export class ShadowValidationError extends Error {
  constructor(public readonly issues: ReturnType<typeof validateTransaction>) {
    super('Transaction validation failed.');
    this.name = 'ShadowValidationError';
  }
}

export class ShadowDuplicateError extends Error {
  constructor() {
    super('This source/externalId pair has already been registered.');
    this.name = 'ShadowDuplicateError';
  }
}

export interface ShadowMonitorDependencies {
  transactions: TransactionRepository;
  audit: AuditRepository;
  policy: MonitorPolicy;
  createId?: () => string;
}

/** MONITOR + CONTROL: records transactions and raises review flags; never moves funds. */
export async function monitorTransaction(
  input: TransactionInput,
  deps: ShadowMonitorDependencies,
): Promise<MonitoringResult> {
  const issues = validateTransaction(input);
  if (issues.length) throw new ShadowValidationError(issues);

  const source = input.source.trim();
  const externalId = input.externalId.trim();
  const existing = await deps.transactions.findBySourceAndExternalId(source, externalId);
  if (existing) throw new ShadowDuplicateError();

  const now = (deps.policy.now ?? (() => new Date()))();
  const flags: RiskFlag[] = [];
  const occurredAt = new Date(input.occurredAt);

  if (!input.counterparty?.trim()) {
    flags.push({ code: 'MISSING_COUNTERPARTY', severity: 'warning', message: 'Counterparty details are missing.' });
  }
  if (occurredAt.getTime() > now.getTime()) {
    flags.push({ code: 'FUTURE_DATED', severity: 'warning', message: 'Transaction timestamp is in the future.' });
  }
  if (deps.policy.largeAmountThresholdMinor !== undefined && input.amountMinor >= deps.policy.largeAmountThresholdMinor) {
    flags.push({ code: 'LARGE_AMOUNT', severity: 'high', message: 'Transaction meets the configured large-amount review threshold.' });
  }
  if (!deps.policy.supportedCurrencies.includes(input.currency)) {
    flags.push({ code: 'UNSUPPORTED_CURRENCY', severity: 'warning', message: 'Currency is not enabled in the current monitoring policy.' });
  }

  const id = (deps.createId ?? (() => crypto.randomUUID()))();
  const requiresHumanReview = flags.some((flag) => flag.severity === 'warning' || flag.severity === 'high');
  const transaction: TransactionRecord = {
    ...input,
    source,
    externalId,
    currency: input.currency,
    id,
    status: requiresHumanReview ? 'needs_review' : 'received',
    receivedAt: now.toISOString(),
  };

  await deps.transactions.insert(transaction);
  await deps.audit.append({
    id: (deps.createId ?? (() => crypto.randomUUID()))(),
    transactionId: id,
    eventType: 'TRANSACTION_RECEIVED',
    details: { source, externalId, amountMinor: input.amountMinor, currency: input.currency, flagCount: flags.length },
    occurredAt: now.toISOString(),
  });

  for (const flag of flags) {
    await deps.audit.append({
      id: (deps.createId ?? (() => crypto.randomUUID()))(),
      transactionId: id,
      eventType: 'RISK_FLAGGED',
      details: { code: flag.code, severity: flag.severity, message: flag.message },
      occurredAt: now.toISOString(),
    });
  }

  return { transaction, flags, requiresHumanReview };
}
