import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.js';
import transactionsRouter from './routes/transactions.js';
import reviewRouter from './routes/review.js';
import auditRouter from './routes/audit.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'shadow-core-backend' }));

app.use('/api/v1', authMiddleware);
app.use('/api/v1/transactions', transactionsRouter);
app.use('/api/v1/transactions', reviewRouter); // review is nested under transactions
app.use('/api/v1/audit-events', auditRouter);

app.listen(port, () => {
  console.log(`SHADOW CORE backend listening on port ${port}`);
});

export default app;
