import { Router } from 'express';
import { getJobs, getJobById, createJob, updateJob, deleteJob, getMyJobs } from '../controllers/jobController';
import { protect, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', getJobs);
router.get('/employer/mine', protect, requireRole('employer'), getMyJobs);
router.get('/:id', getJobById);
router.post('/', protect, requireRole('employer'), createJob);
router.put('/:id', protect, requireRole('employer'), updateJob);
router.delete('/:id', protect, requireRole('employer'), deleteJob);

export default router;
