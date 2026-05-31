import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

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
      : { username: normalizedLogin };
    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, username: user.username, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ message: 'Login failed', detail: error.message });
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
