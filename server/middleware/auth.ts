import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase.js';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Role from user_metadata or app_metadata (configure in Supabase)
    const role = (data.user.app_metadata?.role || data.user.user_metadata?.role || 'viewer') as string;
    req.user = { id: data.user.id, role };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}
