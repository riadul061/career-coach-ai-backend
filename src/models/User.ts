import mongoose, { Schema, Document, Types } from 'mongoose';

export type UserRole = 'seeker' | 'employer' | 'admin';
export type ExperienceLevel = 'entry' | 'mid' | 'senior';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  avatarUrl?: string;
  googleId?: string;

  // seeker-only fields
  skills?: string[];
  experienceLevel?: ExperienceLevel;
  resumeText?: string;
  savedJobs?: Types.ObjectId[];
  appliedJobs?: Types.ObjectId[];

  // employer-only fields
  companyName?: string;
  companyLogoUrl?: string;

  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ['seeker', 'employer', 'admin'], required: true },
    avatarUrl: { type: String },
    googleId: { type: String },

    skills: [{ type: String }],
    experienceLevel: { type: String, enum: ['entry', 'mid', 'senior'] },
    resumeText: { type: String },
    savedJobs: [{ type: Schema.Types.ObjectId, ref: 'Job' }],
    appliedJobs: [{ type: Schema.Types.ObjectId, ref: 'Job' }],

    companyName: { type: String },
    companyLogoUrl: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
