import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { randomUUID } from 'crypto';

const router = Router();

router.post('/:id/review', requireRole('operator'), async (req: AuthenticatedRequest, res) => {
  const { decision, notes } = req.body as { decision: string; notes?: string };
  const allowed = ['approved', 'rejected', 'needs_more_info'];
  if (!allowed.includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision' });
  }

  const txId = req.params.id;
  const reviewerId = req.user!.id;

  // Update status
  const newStatus = decision === 'approved' ? 'reviewed' : decision === 'rejected' ? 'rejected' : 'needs_review';
  const { error: updateErr } = await supabase
    .from('shadow_transactions')
    .update({ status: newStatus })
    .eq('id', txId);

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  // Insert review
  await supabase.from('shadow_reviews').insert({
    id: randomUUID(),
    transaction_id: txId,
    reviewer_id: reviewerId,
    decision,
    notes,
  });

  // Audit event
  await supabase.from('shadow_audit_events').insert({
    id: randomUUID(),
    transaction_id: txId,
    event_type: 'STATUS_CHANGED',
    details: { decision, reviewerId, notes: notes || null },
  });

  res.json({ ok: true, status: newStatus });
});

export default router;
