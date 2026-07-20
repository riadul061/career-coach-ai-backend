import mongoose, { Schema, Document, Types } from 'mongoose';

export type SignalAction = 'viewed' | 'saved' | 'dismissed' | 'applied';

export interface IRecommendationSignal extends Document {
  userId: Types.ObjectId;
  jobId: Types.ObjectId;
  action: SignalAction;
  createdAt: Date;
}

const RecommendationSignalSchema = new Schema<IRecommendationSignal>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  action: { type: String, enum: ['viewed', 'saved', 'dismissed', 'applied'], required: true },
  createdAt: { type: Date, default: Date.now },
});

RecommendationSignalSchema.index({ userId: 1, jobId: 1, action: 1 });

export default mongoose.model<IRecommendationSignal>('RecommendationSignal', RecommendationSignalSchema);
