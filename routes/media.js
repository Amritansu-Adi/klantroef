const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const MediaAsset = require('../models/MediaAsset');
const MediaViewLog = require('../models/MediaViewLog');

const authenticateToken = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiter for view logging (1 request per minute per IP for testing)
const viewRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1,
    message: 'Too many views logged from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});


const STREAM_TOKEN_SECRET = process.env.STREAM_TOKEN_SECRET;
const PORT = process.env.PORT || 3000;


// Add media metadata (authenticated)
router.post('/', authenticateToken, async (req, res) => {
    const { title, type, file_url } = req.body;
    if (!title || !type || !file_url) {
        return res.status(400).json({ message: 'title, type, and file_url required' });
    }
    if (!['video', 'audio'].includes(type)) {
        return res.status(400).json({ message: "type must be 'video' or 'audio'" });
    }
    try {
        const media = new MediaAsset({ title, type, file_url });
        await media.save();
        res.status(201).json(media);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get secure stream URL for media asset
router.get('/:id/stream-url', async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid media ID' });
    }
    try {
        const media = await MediaAsset.findById(id);
        if (!media) {
            return res.status(404).json({ message: 'Media not found' });
        }
        const streamToken = jwt.sign({ mediaId: media._id, fileUrl: media.file_url }, STREAM_TOKEN_SECRET, { expiresIn: '10m' });
        await new MediaViewLog({ media_id: media._id, viewed_by_ip: req.ip }).save();
        res.json({ secure_stream_url: `http://localhost:${PORT}/stream/${streamToken}` });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Streaming access for a media asset
router.get('/stream/:token', (req, res) => {
    const { token } = req.params;
    jwt.verify(token, STREAM_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send('Forbidden: Invalid or expired stream link.');
        }
        res.send(`Access granted to stream file: ${decoded.fileUrl}`);
    });
});


// Analytics Routes
// My plan is to follow the mini-checklist I created:
// 1. Build the POST /:id/view endpoint.
// 2. Build the GET /:id/analytics endpoint.
// 3. Secure both routes with JWT.
// 4. Handle edge cases like invalid IDs.

// STEP 1 & 3 & 4: Log a view, secure it, and handle errors.
router.post('/:id/view', authenticateToken, viewRateLimiter, async (req, res) => {
    // Get the media ID from the request parameters.
    const { id } = req.params;

    // First, validate if the provided ID is a valid MongoDB ObjectId format.
    // This prevents database errors for malformed IDs.
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid media ID' });
    }

    // Check if the media asset actually exists before logging a view.
    const media = await MediaAsset.findById(id);
    if (!media) {
        return res.status(404).json({ message: 'Media not found' });
    }

    // If everything is valid, create and save the new view log.
    try {
        // The log links to the media's ID and includes the viewer's IP and a current timestamp.
        await new MediaViewLog({ media_id: media._id, viewed_by_ip: req.ip, timestamp: new Date() }).save();
        res.status(201).json({ message: 'View logged' });
    } catch (err) {
        // Catch any potential database saving errors.
        res.status(500).json({ message: 'Server error' });
    }
});



// STEP 2 & 3 & 4: Get analytics, secure it, and handle errors.
router.get('/:id/analytics', authenticateToken, async (req, res) => {
    const { id } = req.params;

    // Perform the same validation as the view endpoint.
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid media ID' });
    }
    const media = await MediaAsset.findById(id);
    if (!media) {
        return res.status(404).json({ message: 'Media not found' });
    }

    try {
        // Analytics Logic
        // My initial approach is to fetch all logs into the application's memory
        // and process them here. This is straightforward and works well for a moderate number of views.
        // I've identified that for a high-traffic scenario (e.g., millions of views), this could be
        // inefficient. A more scalable solution, which I've researched, would be to use a
        // MongoDB Aggregation Pipeline to perform these calculations directly in the database.
        // I'm starting with this implementation as a clear, working baseline.

        const logs = await MediaViewLog.find({ media_id: id });

        // 1. Calculate total views: The total number of log documents found.
        const total_views = logs.length;

        // 2. Calculate unique IPs: I'm using a JavaScript Set here. By mapping all IPs into a Set,
        // it automatically handles uniqueness, and I can just get its size for the final count.
        const unique_ips = new Set(logs.map(log => log.viewed_by_ip)).size;

        // 3. Calculate views per day: I'll iterate through each log and group them by date.
        const views_per_day = {};
        logs.forEach(log => {
            // I'm formatting the timestamp to a 'YYYY-MM-DD' string to use as a key in my results object.
            const day = log.timestamp.toISOString().slice(0, 10);
            // If the day isn't a key yet, initialize it; otherwise, increment the count.
            views_per_day[day] = (views_per_day[day] || 0) + 1;
        });

        // Return the final analytics object in the required format.
        res.json({ total_views, unique_ips, views_per_day });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;