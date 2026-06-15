import express from 'express';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('admin'), async (req, res) => {
  const users = await User.find({}, '-passwordHash').sort({ createdAt: -1 });
  res.json(users);
});

router.put('/:id/approve', requireRole('admin'), async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { active: true },
    { new: true, select: '-passwordHash' }
  );
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

export default router;
