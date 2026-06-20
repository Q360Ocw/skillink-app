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
