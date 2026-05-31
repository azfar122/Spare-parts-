import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, email, password } = req.body;
  const query = username ? { username: String(username).toLowerCase() } : { email: String(email).toLowerCase() };
  const user = await User.findOne(query);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.json({ token, user: { id: user._id, name: user.name, username: user.username, email: user.email, role: user.role } });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
