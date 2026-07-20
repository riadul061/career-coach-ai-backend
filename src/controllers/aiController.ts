import { Response } from 'express';
import Job from '../models/Job';
import User from '../models/User';
import ChatMessage from '../models/ChatMessage';
import RecommendationSignal from '../models/RecommendationSignal';
import { AuthRequest } from '../middleware/auth';
import { streamChatResponse, generateJSON, generateText } from '../services/aiService';

// POST /api/ai/chat  (Server-Sent Events stream)
// body: { message: string, jobId?: string }
export const chatWithAssistant = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { message, jobId } = req.body as { message: string; jobId?: string };

  if (!message?.trim()) {
    return res.status(400).json({ message: 'message is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    let jobContext = '';
    if (jobId) {
      const job = await Job.findById(jobId);
      if (job) {
        jobContext = `The user is currently viewing this job listing:
Title: ${job.title}
Company: ${job.companyName}
Location: ${job.location}${job.remote ? ' (Remote)' : ''}
Salary range: $${job.salaryMin} - $${job.salaryMax}
Experience level: ${job.experienceLevel}
Description: ${job.description}
Requirements: ${job.requirements.join(', ')}`;
      }
    }

    const systemPrompt = `You are a helpful, encouraging AI career coach embedded in a job platform. Give concise, practical advice about job searching, interview prep, resumes, and career decisions. When relevant, reference the job the user is currently viewing.
${jobContext}`;

    const previousMessages = await ChatMessage.find({ userId, ...(jobId ? { jobId } : {}) })
      .sort('-createdAt')
      .limit(10);

    const history = previousMessages
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    await ChatMessage.create({ userId, jobId: jobId || undefined, role: 'user', content: message });

    const fullText = await streamChatResponse(systemPrompt, history, message, (chunk) => {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });

    await ChatMessage.create({ userId, jobId: jobId || undefined, role: 'assistant', content: fullText });

    // Generate 2-3 suggested follow-up prompts based on the exchange
    let suggestions: string[] = [];
    try {
      suggestions = await generateJSON<string[]>(
        `Based on this career-coaching exchange, suggest 3 short natural follow-up questions the user might ask next. Respond with a JSON array of 3 strings only.\nUser: ${message}\nAssistant: ${fullText}`
      );
    } catch {
      suggestions = [];
    }

    res.write(`data: ${JSON.stringify({ done: true, suggestions })}\n\n`);
    res.end();
  } catch (error) {
    console.error('chatWithAssistant error:', error);
    res.write(`data: ${JSON.stringify({ error: 'AI assistant failed to respond' })}\n\n`);
    res.end();
  }
};

// POST /api/ai/recommendations
export const getRecommendations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { category } = req.body as { category?: string };

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const signals = await RecommendationSignal.find({ userId }).sort('-createdAt').limit(30);
    const savedOrAppliedJobIds = [...(user.savedJobs || []), ...(user.appliedJobs || [])];
    const referenceJobs = await Job.find({ _id: { $in: savedOrAppliedJobIds } });
    const referenceCategories = [...new Set(referenceJobs.map((j) => j.category))];
    const referenceLocations = [...new Set(referenceJobs.map((j) => j.location))];

    const candidateFilter: Record<string, any> = { status: 'open' };
    if (category) candidateFilter.category = category;
    else if (referenceCategories.length || referenceLocations.length) {
      candidateFilter.$or = [
        ...(referenceCategories.length ? [{ category: { $in: referenceCategories } }] : []),
        ...(referenceLocations.length ? [{ location: { $in: referenceLocations } }] : []),
      ];
    }

    let candidates = await Job.find(candidateFilter).limit(30);
    if (candidates.length === 0) {
      candidates = await Job.find({ status: 'open' }).sort('-postedAt').limit(30);
    }

    const dismissedIds = new Set(
      signals.filter((s) => s.action === 'dismissed').map((s) => s.jobId.toString())
    );
    candidates = candidates.filter((c) => !dismissedIds.has(c._id.toString()));

    if (candidates.length === 0) {
      return res.json({ recommendations: [] });
    }

    const prompt = `You are matching a job seeker to job listings.

Seeker profile:
- Skills: ${(user.skills || []).join(', ') || 'not specified'}
- Experience level: ${user.experienceLevel || 'not specified'}
- Resume summary: ${user.resumeText || 'not provided'}

Recent behavior signals: ${signals.map((s) => `${s.action} job ${s.jobId}`).join('; ') || 'none yet'}

Candidate jobs (JSON):
${JSON.stringify(
  candidates.map((c) => ({
    jobId: c._id.toString(),
    title: c.title,
    category: c.category,
    location: c.location,
    experienceLevel: c.experienceLevel,
    salaryMin: c.salaryMin,
    salaryMax: c.salaryMax,
    requirements: c.requirements,
  }))
)}

Rank the candidates for this seeker. Respond with ONLY a JSON array, no markdown, in this exact shape:
[{ "jobId": "...", "score": 0-100, "reason": "one short sentence" }]
Include at most 12 jobs, highest score first.`;

    const ranked = await generateJSON<{ jobId: string; score: number; reason: string }[]>(prompt);

    const jobMap = new Map(candidates.map((c) => [c._id.toString(), c]));
    const recommendations = ranked
      .filter((r) => jobMap.has(r.jobId))
      .map((r) => ({ job: jobMap.get(r.jobId), score: r.score, reason: r.reason }));

    res.json({ recommendations });
  } catch (error) {
    console.error('getRecommendations error:', error);
    res.status(500).json({ message: 'Failed to generate recommendations' });
  }
};

// POST /api/ai/generate-description
export const generateJobDescription = async (req: AuthRequest, res: Response) => {
  try {
    const { title, bullets, length = 'medium', tone = 'professional' } = req.body as {
      title: string;
      bullets: string[];
      length?: 'short' | 'medium' | 'long';
      tone?: string;
    };

    if (!title || !bullets?.length) {
      return res.status(400).json({ message: 'title and bullets are required' });
    }

    const lengthGuide =
      length === 'short' ? '2-3 short paragraphs' : length === 'long' ? '5-6 detailed paragraphs' : '3-4 paragraphs';

    const prompt = `Write a compelling, ${tone} job description for the role "${title}".
Base it on these bullet points:
${bullets.map((b) => `- ${b}`).join('\n')}

Length: ${lengthGuide}. Structure it with a brief intro, responsibilities, and requirements. Do not use markdown headers, just well-organized prose and bullet lists where natural. Do not invent a company name.`;

    const description = await generateText(prompt);
    res.json({ description });
  } catch (error) {
    console.error('generateJobDescription error:', error);
    res.status(500).json({ message: 'Failed to generate job description' });
  }
};

// POST /api/ai/signal
export const logSignal = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { jobId, action } = req.body as { jobId: string; action: 'viewed' | 'saved' | 'dismissed' | 'applied' };

    if (!jobId || !['viewed', 'saved', 'dismissed', 'applied'].includes(action)) {
      return res.status(400).json({ message: 'Valid jobId and action are required' });
    }

    await RecommendationSignal.create({ userId, jobId, action });

    if (action === 'saved') {
      await User.findByIdAndUpdate(userId, { $addToSet: { savedJobs: jobId } });
    } else if (action === 'dismissed') {
      await User.findByIdAndUpdate(userId, { $pull: { savedJobs: jobId } });
    }

    res.status(201).json({ message: 'Signal recorded' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to record signal' });
  }
};
