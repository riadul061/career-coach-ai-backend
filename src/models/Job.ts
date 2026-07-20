import mongoose, { Schema, Document, Types } from 'mongoose';

export type JobStatus = 'open' | 'closed';
export type ExperienceLevel = 'entry' | 'mid' | 'senior';

export interface IJob extends Document {
  title: string;
  employerId: Types.ObjectId;
  companyName: string;
  companyLogoUrl?: string;
  description: string;
  requirements: string[];
  category: string;
  location: string;
  remote: boolean;
  salaryMin: number;
  salaryMax: number;
  experienceLevel: ExperienceLevel;
  status: JobStatus;
  postedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    title: { type: String, required: true, trim: true },
    employerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companyName: { type: String, required: true },
    companyLogoUrl: { type: String },
    description: { type: String, required: true },
    requirements: [{ type: String }],
    category: { type: String, required: true, index: true },
    location: { type: String, required: true, index: true },
    remote: { type: Boolean, default: false },
    salaryMin: { type: Number, required: true },
    salaryMax: { type: Number, required: true },
    experienceLevel: { type: String, enum: ['entry', 'mid', 'senior'], required: true, index: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    postedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

JobSchema.index({ title: 'text', description: 'text', companyName: 'text' });

export default mongoose.model<IJob>('Job', JobSchema);
