import { Response } from 'express';
import Job from '../models/Job';
import { AuthRequest } from '../middleware/auth';

// GET /api/jobs?search=&category=&location=&experienceLevel=&minSalary=&maxSalary=&sort=&page=&limit=
export const getJobs = async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      category,
      location,
      experienceLevel,
      minSalary,
      maxSalary,
      sort = '-postedAt',
      page = '1',
      limit = '12',
    } = req.query as Record<string, string>;

    const filter: Record<string, any> = { status: 'open' };

    if (search) filter.$text = { $search: search };
    if (category) filter.category = category;
    if (location) filter.location = location;
    if (experienceLevel) filter.experienceLevel = experienceLevel;
    if (minSalary || maxSalary) {
      filter.salaryMax = { ...(minSalary && { $gte: Number(minSalary) }) };
      filter.salaryMin = { ...(maxSalary && { $lte: Number(maxSalary) }) };
      // Clean up empty filter objects
      if (Object.keys(filter.salaryMax).length === 0) delete filter.salaryMax;
      if (Object.keys(filter.salaryMin).length === 0) delete filter.salaryMin;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const [jobs, total] = await Promise.all([
      Job.find(filter).sort(sort).skip(skip).limit(limitNum),
      Job.countDocuments(filter),
    ]);

    res.json({
      jobs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('getJobs error:', error);
    res.status(500).json({ message: 'Failed to fetch jobs' });
  }
};

export const getJobById = async (req: AuthRequest, res: Response) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const related = await Job.find({
      _id: { $ne: job._id },
      category: job.category,
      status: 'open',
    }).limit(4);

    res.json({ job, related });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch job' });
  }
};

export const createJob = async (req: AuthRequest, res: Response) => {
  try {
    const employerId = req.user!.userId;
    const job = await Job.create({ ...req.body, employerId });
    res.status(201).json({ job });
  } catch (error) {
    console.error('createJob error:', error);
    res.status(500).json({ message: 'Failed to create job' });
  }
};

export const updateJob = async (req: AuthRequest, res: Response) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.employerId.toString() !== req.user!.userId) {
      return res.status(403).json({ message: 'You do not own this job listing' });
    }

    Object.assign(job, req.body);
    await job.save();
    res.json({ job });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update job' });
  }
};

export const deleteJob = async (req: AuthRequest, res: Response) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.employerId.toString() !== req.user!.userId) {
      return res.status(403).json({ message: 'You do not own this job listing' });
    }

    await job.deleteOne();
    res.json({ message: 'Job deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete job' });
  }
};

export const getMyJobs = async (req: AuthRequest, res: Response) => {
  try {
    const jobs = await Job.find({ employerId: req.user!.userId }).sort('-createdAt');
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch your jobs' });
  }
};
