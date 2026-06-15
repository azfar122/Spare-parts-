import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function salesUsername(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

router.post('/register-sales', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const password = String(req.body.password || '');
    if (!name) return res.status(400).json({ message: 'Salesperson name is required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const username = salesUsername(name);
    if (!username) return res.status(400).json({ message: 'Enter a valid salesperson name' });

    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ message: 'This salesperson account already exists. Please log in or ask admin for approval.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      username,
      email: `${username}@sales.local`,
      passwordHash,
      role: 'sales',
      active: false
    });

    res.status(201).json({
      message: 'Account request sent to admin for approval.',
      user: { id: user._id, name: user.name, username: user.username, role: user.role, active: user.active }
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'This salesperson account already exists. Please log in or ask admin for approval.' });
    res.status(500).json({ message: 'Account request failed', detail: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'JWT_SECRET is required' });
    }

    const { username, email, password } = req.body;
    const login = username || email;
    if (!login || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const normalizedLogin = String(login).toLowerCase().trim();
    const query = login.includes('@')
      ? { email: normalizedLogin }
      : { $or: [{ username: normalizedLogin }, { username: salesUsername(login) }] };
    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.active) return res.status(403).json({ message: 'Your account is waiting for admin approval.' });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, username: user.username, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ message: 'Login failed', detail: error.message });
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
