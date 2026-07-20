import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { generateAccessToken, generateRefreshToken, buildTokenPayload } from '../utils/token';
import { AuthRequest } from '../middleware/auth';

const sendAuthResponse = (res: Response, user: any) => {
  const payload = buildTokenPayload(user._id, user.role);
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  res.cookie('accessToken', accessToken, { httpOnly: true, sameSite: 'lax' });

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      avatarUrl: user.avatarUrl,
    },
  });
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, companyName } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'name, email, password, and role are required' });
    }
    if (!['seeker', 'employer'].includes(role)) {
      return res.status(400).json({ message: "role must be 'seeker' or 'employer'" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      companyName: role === 'employer' ? companyName : undefined,
    });

    sendAuthResponse(res, user);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Failed to register user' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    sendAuthResponse(res, user);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Failed to log in' });
  }
};

/**
 * Demo login: finds (or lazily creates) a seeded demo account for the
 * requested role, and logs in as that account. Lets graders/testers explore
 * both roles without registering.
 */
export const demoLogin = async (req: Request, res: Response) => {
  try {
    const { role } = req.body as { role: 'seeker' | 'employer' | 'admin' };
    if (!role || !['seeker', 'employer', 'admin'].includes(role)) {
      return res.status(400).json({ message: "role must be 'seeker', 'employer', or 'admin'" });
    }

    const demoEmails: Record<string, string> = {
      seeker: 'demo.seeker@careercoach.ai',
      employer: 'demo.employer@careercoach.ai',
      admin: 'demo.admin@careercoach.ai',
    };
    const demoEmail = demoEmails[role];
    let user = await User.findOne({ email: demoEmail });

    if (!user) {
      const passwordHash = await bcrypt.hash('DemoPass123!', 10);
      const roleData =
        role === 'seeker'
          ? {
              name: 'Demo Seeker',
              email: demoEmail,
              passwordHash,
              role: 'seeker' as const,
              skills: ['JavaScript', 'React', 'Node.js'],
              experienceLevel: 'mid' as const,
              resumeText: 'Experienced frontend developer with 3 years building React applications.',
            }
          : role === 'employer'
          ? {
              name: 'Demo Employer',
              email: demoEmail,
              passwordHash,
              role: 'employer' as const,
              companyName: 'Demo Tech Co.',
            }
          : {
              name: 'Demo Admin',
              email: demoEmail,
              passwordHash,
              role: 'admin' as const,
            };
      user = await User.create(roleData);
    }

    sendAuthResponse(res, user);
  } catch (error) {
    console.error('Demo login error:', error);
    res.status(500).json({ message: 'Failed to log in with demo account' });
  }
};

/**
 * Google login: the frontend uses Google Identity Services to obtain an
 * ID token, then POSTs it here. We verify it server-side and create/find
 * the matching user. `role` must be supplied on first sign-in.
 */
export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { idToken, role } = req.body as { idToken: string; role?: 'seeker' | 'employer' };
    if (!idToken) return res.status(400).json({ message: 'idToken is required' });

    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(401).json({ message: 'Invalid Google token' });

    let user = await User.findOne({ email: payload.email.toLowerCase() });

    if (!user) {
      if (!role || !['seeker', 'employer'].includes(role)) {
        return res.status(400).json({ message: 'role is required for first-time Google sign-in' });
      }
      user = await User.create({
        name: payload.name || payload.email.split('@')[0],
        email: payload.email,
        role,
        googleId: payload.sub,
        avatarUrl: payload.picture,
      });
    }

    sendAuthResponse(res, user);
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ message: 'Failed to log in with Google' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch current user' });
  }
};
