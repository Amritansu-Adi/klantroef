const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const MediaAsset = require('../models/MediaAsset');
const MediaViewLog = require('../models/MediaViewLog');
const authenticateToken = require('../middleware/auth');


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

// Simulate streaming access for a media asset
router.get('/stream/:token', (req, res) => {
    const { token } = req.params;
    jwt.verify(token, STREAM_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send('Forbidden: Invalid or expired stream link.');
        }
        res.send(`Access granted to stream file: ${decoded.fileUrl}`);
    });
});

module.exports = router;