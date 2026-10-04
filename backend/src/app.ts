import { existsSync } from 'node:fs';
import path from 'node:path';

import cors from 'cors';
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { accountRouter } from './routes/accountRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { transactionRouter } from './routes/transactionRoutes.js';
import { transferRouter } from './routes/transferRoutes.js';

const app = express();

if (env.isProd) {
  // Behind a hosting proxy (Render, Fly, Railway...) so req.ip is the client's address.
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: '20kb' }));

const api = Router();
api.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest,
  }),
);
api.use(healthRouter);
api.use('/auth', authRouter);
api.use('/accounts', accountRouter);
api.use('/transfers', transferRouter);
api.use('/transactions', transactionRouter);
api.use('/admin', adminRouter);
api.use(notFoundHandler);

app.use(healthRouter);
app.use('/api', api);

// Optional single-service deployment: serve the built React app as well.
if (env.staticDir && existsSync(env.staticDir)) {
  const staticDir = path.resolve(env.staticDir);
  app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
