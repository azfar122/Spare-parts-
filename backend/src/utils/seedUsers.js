import 'dotenv/config';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { connectDb } from './db.js';

await connectDb();
const users = [
  { name: 'Admin', username: 'admin', email: 'admin@spares.local', password: 'Admin@12345', role: 'admin' },
  { name: 'Sales User', username: 'sales', email: 'sales@spares.local', password: 'Sales@12345', role: 'sales' }
];
for (const u of users) {
  const passwordHash = await bcrypt.hash(u.password, 10);
  await User.updateOne(
    { username: u.username },
    { $set: { name: u.name, username: u.username, email: u.email, passwordHash, role: u.role, active: true } },
    { upsert: true }
  );
}
console.log('Seeded users: admin/Admin@12345, sales/Sales@12345');
process.exit(0);
