import { Router } from 'express';
import { register, login, demoLogin, googleLogin, getMe } from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/demo-login', demoLogin);
router.post('/google', googleLogin);
router.get('/me', protect, getMe);

export default router;
