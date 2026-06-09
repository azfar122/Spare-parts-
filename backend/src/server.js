import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import { Server } from 'socket.io';
import { connectDb, getDbReadyState } from './utils/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import saleRoutes from './routes/saleRoutes.js';
import returnRoutes from './routes/returnRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import warehouseRoutes from './routes/warehouseRoutes.js';

const app = express();
const server = http.createServer(app);
const configuredClientUrl = process.env.CLIENT_URL || process.env.VERCEL_URL || 'http://localhost:5173';
const clientOrigin = configuredClientUrl.replace(/\/+$/, '');
const localTwinOrigin = clientOrigin.includes('localhost')
  ? clientOrigin.replace('localhost', '127.0.0.1')
  : clientOrigin.replace('127.0.0.1', 'localhost');
const allowedOrigins = [...new Set([clientOrigin, localTwinOrigin])];
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true
};
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true }
});

app.set('io', io);
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const health = (_, res) => res.json({
  ok: true,
  mongoConfigured: Boolean(process.env.MONGO_URI),
  jwtConfigured: Boolean(process.env.JWT_SECRET),
  mongoReadyState: getDbReadyState()
});

async function requireDb(_, res, next) {
  try {
    await connectDb();
    next();
  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(500).json({
      message: 'Database connection failed',
      detail: error.message
    });
  }
}

app.get('/health', health);
app.get('/api/health', health);
app.use('/api', requireDb);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/returns', returnRoutes);

io.on('connection', socket => {
  console.log('Socket connected', socket.id);
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
}

app.use((error, _, res, __) => {
  console.error('Unhandled API error:', error);
  res.status(500).json({ message: 'Internal server error', detail: error.message });
});

export default app;
export { server, io };
