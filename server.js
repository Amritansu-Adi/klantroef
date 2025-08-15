require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = express();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const STREAM_TOKEN_SECRET = process.env.STREAM_TOKEN_SECRET;

app.use(express.json());

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Modular routes
app.use('/auth', require('./routes/auth'));
app.use('/media', require('./routes/media'));

// Add streaming access for a media asset at root
app.get('/stream/:token', (req, res) => {
    const { token } = req.params;
    jwt.verify(token, STREAM_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send('Forbidden: Invalid or expired stream link.');
        }
        res.send(`Access granted to stream file: ${decoded.fileUrl}`);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
