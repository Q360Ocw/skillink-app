import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  phone: String,
  avatar: String,
  bio: String,
  role: { type: String, enum: ['learner', 'creator', 'admin'], default: 'learner' },
  location: { city: String, country: { type: String, default: 'Algeria' } },
  stats: {
    followers: { type: Number, default: 0 },
    following: { type: Number, default: 0 },
    reels: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 }
  },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcryptjs.genSalt(10);
  this.password = await bcryptjs.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcryptjs.compare(enteredPassword, this.password);
};

userSchema.methods.toJSON = function() {
  const { password, ...user } = this.toObject();
  return user;
};

export default mongoose.model('User', userSchema);
