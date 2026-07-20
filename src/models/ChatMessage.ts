import mongoose, { Schema, Document, Types } from 'mongoose';

export type ChatRole = 'user' | 'assistant';

export interface IChatMessage extends Document {
  userId: Types.ObjectId;
  jobId?: Types.ObjectId;
  role: ChatRole;
  content: string;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job' },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
