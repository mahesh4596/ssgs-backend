const express = require('express');
const router = express.Router();
const User = require('../models/User');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Presence Check for Env Vars
if (!process.env.SENDER_EMAIL || !process.env.EMAIL_APP_PASSWORD) {
    console.warn('⚠️ WARNING: SENDER_EMAIL or EMAIL_APP_PASSWORD is not set. Email verification will fail.');
}

// Configure Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: (process.env.SENDER_EMAIL || '').trim(),
        pass: (process.env.EMAIL_APP_PASSWORD || '').trim()
    },
    debug: true, // Show debug info in logs
    logger: true, // Log to console
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 60000
});

// Detailed connectivity verification
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ EMAIL ENGINE CRITICAL ERROR:', error.message);
        console.log('🔍 SYSTEM DEBUG: Use 16-character App Password (not your Gmail password)');
    } else {
        console.log('📧 Email Engine [Port 465/SSL] is Active! ✅');
    }
});

// 1. Signup Route (Simple)
router.post('/signup', async (req, res) => {
    try {
        let { name, email, password, phone } = req.body;
        email = email.trim().toLowerCase();

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Determine if user is admin
        const isAdmin = email === (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

        const user = new User({
            name,
            email,
            password: hashedPassword,
            phone,
            isAdmin,
            isVerified: true // Automatically verified
        });

        await user.save();

        res.json({ message: 'Signup Successful! ✅', user });
    } catch (err) {
        console.error('❌ SIGNUP ERROR:', err);
        res.status(400).json({ message: 'Error: ' + err.message });
    }
});


// Login with Verification
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.trim() });

        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Check password
        let isMatch = await bcrypt.compare(password, user.password);

        // MIGRATION: If not a hashed match, check if it's an old plain-text password
        if (!isMatch && password === user.password) {
            console.log('Migrating old plain-text password for:', user.email);
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            await user.save();
            isMatch = true; // Mark as matched after migration
        }

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Auto-upgrade to Admin if email matches
        const isAdminEmail = email.trim().toLowerCase() === (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
        if (isAdminEmail && !user.isAdmin) {
            user.isAdmin = true;
            await user.save();
        }

        res.json({ message: 'Login success!', user });
    } catch (err) {
        res.status(400).json({ message: 'Error logging in', error: err.message });
    }
});

// Update Profile with hashing if needed
router.post('/update-profile', async (req, res) => {
    try {
        const { userId, name, phone, password } = req.body;
        const user = await User.findById(userId);
        if (user) {
            if (name) user.name = name;
            if (phone) user.phone = phone;
            if (password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(password, salt);
            }
            await user.save();
            res.json({ message: 'Profile updated!', user });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (err) {
        res.status(400).json({ message: 'Error updating profile', error: err.message });
    }
});

module.exports = router;
