import mongoose from 'mongoose';

const reelSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, maxlength: 200 },
  description: String,
  category: { type: String, enum: ['Design', 'Coding', 'Marketing', 'Content Creation', 'AI'], required: true },
  videoUrl: { type: String, required: true },
  thumbnail: String,
  duration: Number,
  tags: [String],
  engagement: {
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    saves: { type: Number, default: 0 }
  },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isPublished: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

reelSchema.index({ creator: 1, createdAt: -1 });
reelSchema.index({ category: 1 });

export default mongoose.model('Reel', reelSchema);
