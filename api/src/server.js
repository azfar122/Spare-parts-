import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import { Server } from 'socket.io';
import { connectDb } from './utils/db.js';
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
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || process.env.VERCEL_URL || 'http://localhost:5173', credentials: true }
});

app.set('io', io);
app.use(cors({ origin: process.env.CLIENT_URL || process.env.VERCEL_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/health', (_, res) => res.json({ ok: true }));
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

await connectDb();

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
}

export default app;
export { server, io };
