import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/authRoutes.js';
import { accountRouter } from './routes/accountRoutes.js';
import { transferRouter } from './routes/transferRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { transactionRouter } from './routes/transactionRoutes.js';

const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  }),
);

app.use(helmet());
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.json());

app.use(healthRouter);
app.use('/auth', authRouter);
app.use('/accounts', accountRouter);
app.use('/transfers', transferRouter);
app.use('/admin', adminRouter);
app.use('/transactions', transactionRouter);

app.use(errorHandler);

export default app;
