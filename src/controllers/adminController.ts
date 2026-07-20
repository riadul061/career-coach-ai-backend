import { Response } from 'express';
import User from '../models/User';
import Job from '../models/Job';
import Application from '../models/Application';
import { AuthRequest } from '../middleware/auth';

export const getStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [totalUsers, totalSeekers, totalEmployers, totalJobs, openJobs, totalApplications] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'seeker' }),
      User.countDocuments({ role: 'employer' }),
      Job.countDocuments(),
      Job.countDocuments({ status: 'open' }),
      Application.countDocuments(),
    ]);

    res.json({
      totalUsers,
      totalSeekers,
      totalEmployers,
      totalJobs,
      openJobs,
      totalApplications,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch platform stats' });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.query as { role?: string };
    const filter = role ? { role } : {};
    const users = await User.find(filter).sort('-createdAt');
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target._id.toString() === req.user!.userId) {
      return res.status(400).json({ message: 'You cannot delete your own admin account' });
    }
    await target.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

export const getAllJobsAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query as { status?: string };
    const filter = status ? { status } : {};
    const jobs = await Job.find(filter).sort('-createdAt');
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch jobs' });
  }
};

export const deleteJobAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    await job.deleteOne();
    res.json({ message: 'Job removed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete job' });
  }
};
