import { Response } from 'express';
import Application from '../models/Application';
import Job from '../models/Job';
import User from '../models/User';
import RecommendationSignal from '../models/RecommendationSignal';
import { AuthRequest } from '../middleware/auth';

export const applyToJob = async (req: AuthRequest, res: Response) => {
  try {
    const seekerId = req.user!.userId;
    const { jobId } = req.body;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const existing = await Application.findOne({ jobId, seekerId });
    if (existing) return res.status(409).json({ message: 'You have already applied to this job' });

    const application = await Application.create({ jobId, seekerId });

    await User.findByIdAndUpdate(seekerId, { $addToSet: { appliedJobs: jobId } });
    await RecommendationSignal.create({ userId: seekerId, jobId, action: 'applied' });

    res.status(201).json({ application });
  } catch (error) {
    console.error('applyToJob error:', error);
    res.status(500).json({ message: 'Failed to submit application' });
  }
};

export const getMyApplications = async (req: AuthRequest, res: Response) => {
  try {
    const applications = await Application.find({ seekerId: req.user!.userId })
      .populate('jobId')
      .sort('-appliedAt');
    res.json({ applications });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch applications' });
  }
};

export const getApplicantsForJob = async (req: AuthRequest, res: Response) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.employerId.toString() !== req.user!.userId) {
      return res.status(403).json({ message: 'You do not own this job listing' });
    }

    const applications = await Application.find({ jobId: req.params.jobId })
      .populate('seekerId', 'name email skills experienceLevel resumeText')
      .sort('-appliedAt');

    res.json({ applications });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch applicants' });
  }
};
