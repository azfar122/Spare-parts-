import express from 'express';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('admin'), async (req, res) => {
  const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
  res.json(users);
});

export default router;
