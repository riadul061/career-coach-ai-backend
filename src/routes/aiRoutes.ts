import { Router } from 'express';
import {
  chatWithAssistant,
  getRecommendations,
  generateJobDescription,
  logSignal,
} from '../controllers/aiController';
import { protect, requireRole } from '../middleware/auth';

const router = Router();

router.post('/chat', protect, chatWithAssistant);
router.post('/recommendations', protect, requireRole('seeker'), getRecommendations);
router.post('/generate-description', protect, requireRole('employer'), generateJobDescription);
router.post('/signal', protect, requireRole('seeker'), logSignal);

export default router;
