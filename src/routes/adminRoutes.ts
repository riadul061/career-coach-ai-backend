import { Router } from 'express';
import { getStats, getAllUsers, deleteUser, getAllJobsAdmin, deleteJobAdmin } from '../controllers/adminController';
import { protect, requireRole } from '../middleware/auth';

const router = Router();

router.use(protect, requireRole('admin'));

router.get('/stats', getStats);
router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);
router.get('/jobs', getAllJobsAdmin);
router.delete('/jobs/:id', deleteJobAdmin);

export default router;
