import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.get('/', requireRole('operator', 'auditor'), async (req, res) => {
  const { data, error } = await supabase
    .from('shadow_audit_events')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
