import { Router } from 'express';
import { monitorTransaction, ShadowValidationError, ShadowDuplicateError } from '../../src/lib/shadow/monitor.js';
import { SupabaseTransactionRepository, SupabaseAuditRepository } from '../db/repositories.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
const txRepo = new SupabaseTransactionRepository();
const auditRepo = new SupabaseAuditRepository();

const policy = {
  supportedCurrencies: (process.env.SUPPORTED_CURRENCIES || 'ILS,USD').split(','),
  largeAmountThresholdMinor: process.env.LARGE_AMOUNT_THRESHOLD_MINOR
    ? Number(process.env.LARGE_AMOUNT_THRESHOLD_MINOR)
    : undefined,
};

router.post('/', requireRole('operator', 'system'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await monitorTransaction(req.body, {
      transactions: txRepo,
      audit: auditRepo,
      policy,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ShadowValidationError) {
      return res.status(400).json({ errors: err.issues });
    }
    if (err instanceof ShadowDuplicateError) {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', requireRole('operator', 'viewer', 'auditor'), async (req, res) => {
  // Simple list - in production add pagination, filters
  const { data, error } = await (await import('../db/supabase.js')).supabase
    .from('shadow_transactions')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/:id', requireRole('operator', 'viewer', 'auditor'), async (req, res) => {
  const { data, error } = await (await import('../db/supabase.js')).supabase
    .from('shadow_transactions')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

export default router;
