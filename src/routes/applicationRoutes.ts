import { Router } from 'express';
import { applyToJob, getMyApplications, getApplicantsForJob } from '../controllers/applicationController';
import { protect, requireRole } from '../middleware/auth';

const router = Router();

router.post('/', protect, requireRole('seeker'), applyToJob);
router.get('/mine', protect, requireRole('seeker'), getMyApplications);
router.get('/job/:jobId', protect, requireRole('employer'), getApplicantsForJob);

export default router;
