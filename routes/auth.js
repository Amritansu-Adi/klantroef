const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

const JWT_SECRET = process.env.JWT_SECRET;

// Register a new user
router.post('/signup', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required' });
    }
    try {
        const exists = await AdminUser.findOne({ email });
        if (exists) {
            return res.status(409).json({ message: 'User already exists' });
        }
        const hashed_password = await bcrypt.hash(password, 10);
        const user = new AdminUser({ email, hashed_password });
        await user.save();
        res.status(201).json({ id: user._id, email: user.email });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Login and get JWT token
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required' });
    }
    try {
        const user = await AdminUser.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const valid = await bcrypt.compare(password, user.hashed_password);
        if (!valid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
