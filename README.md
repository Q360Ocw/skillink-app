{
  "name": "skillink-app",
  "version": "2.0.0",
  "description": "Algerian platform for skills, services, and live learning",
  "type": "module",
  "main": "server/index.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "nodemon server/index.js",
    "dev:client": "cd client && npm run dev",
    "build": "cd client && npm run build",
    "start": "node server/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.5.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
# skillink-app
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb://localhost:27017/skillink
JWT_SECRET=your-secret-key-here
JWT_EXPIRE=7d
node_modules/
.env
dist/
uploads/
.DS_Store
*.log
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import reelRoutes from './routes/reels.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reels', reelRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(PORT, () => {
  console.log(`✅ Server on http://localhost:${PORT}`);
});
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ DB Error:', error.message);
    process.exit(1);
  }
};

export default connectDB;
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
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User exists' });

    user = new User({ fullName, email, password, role: role || 'learner' });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({ success: true, token, user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    user.updatedAt = new Date();
    await user.save();

    const token = generateToken(user._id);
    res.json({ success: true, token, user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/me', protect, (req, res) => {
  res.json({ success: true, user: req.user.toJSON() });
});

export default router;
import express from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (role) query.role = role;
    if (search) query.fullName = new RegExp(search, 'i');

    const users = await User.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);
    res.json({ success: true, total, page: parseInt(page), users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/profile', protect, async (req, res) => {
  try {
    const { fullName, bio, phone, location } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { fullName, bio, phone, location, updatedAt: new Date() },
      { new: true }
    );
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
import express from 'express';
import Reel from '../models/Reel.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let query = { isPublished: true };
    if (category) query.category = category;

    const reels = await Reel.find(query)
      .populate('creator', 'fullName avatar isVerified')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Reel.countDocuments(query);
    res.json({ success: true, total, page: parseInt(page), reels });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id).populate('creator', 'fullName avatar bio');
    if (!reel) return res.status(404).json({ message: 'Reel not found' });
    reel.engagement.views += 1;
    await reel.save();
    res.json({ success: true, reel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { title, description, category, videoUrl, tags } = req.body;
    const reel = new Reel({
      creator: req.user._id,
      title,
      description,
      category,
      videoUrl,
      tags
    });
    await reel.save();
    await reel.populate('creator', 'fullName avatar');
    res.status(201).json({ success: true, reel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/like', protect, async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ message: 'Reel not found' });

    if (!reel.likedBy.includes(req.user._id)) {
      reel.likedBy.push(req.user._id);
      reel.engagement.likes += 1;
    } else {
      reel.likedBy = reel.likedBy.filter(id => !id.equals(req.user._id));
      reel.engagement.likes -= 1;
    }
    await reel.save();
    res.json({ success: true, reel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
