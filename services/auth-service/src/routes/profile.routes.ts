import { Router } from 'express';
import { profileController } from '../controllers/profile.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/me', requireAuth, profileController.getMe);
router.put('/me', requireAuth, profileController.updateMe);

export default router;
