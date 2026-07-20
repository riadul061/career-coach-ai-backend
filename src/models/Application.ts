import mongoose, { Schema, Document, Types } from 'mongoose';

export type ApplicationStatus = 'submitted' | 'reviewed' | 'rejected' | 'accepted';

export interface IApplication extends Document {
  jobId: Types.ObjectId;
  seekerId: Types.ObjectId;
  status: ApplicationStatus;
  appliedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>({
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  seekerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['submitted', 'reviewed', 'rejected', 'accepted'], default: 'submitted' },
  appliedAt: { type: Date, default: Date.now },
});

ApplicationSchema.index({ jobId: 1, seekerId: 1 }, { unique: true });

export default mongoose.model<IApplication>('Application', ApplicationSchema);
