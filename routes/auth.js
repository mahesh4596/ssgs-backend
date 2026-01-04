const express = require('express');
const router = express.Router();
const User = require('../models/User');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Configure Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SENDER_EMAIL,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

// 1. Send Verification Code
router.post('/send-code', async (req, res) => {
    try {
        const { email } = req.body;
        const code = Math.floor(1000 + Math.random() * 9000).toString(); // 4 Digit Code

        // Check if user already exists and is verified
        let user = await User.findOne({ email: email.toLowerCase().trim() });
        if (user && user.isVerified) {
            return res.status(400).json({ message: 'User already verified. Please Login.' });
        }

        // If user doesn't exist, create a temporary (unverified) one
        if (!user) {
            user = new User({
                name: 'Guest',
                email: email.toLowerCase().trim(),
                password: 'temp',
                isVerified: false
            });
        }

        user.verificationCode = code;
        await user.save();

        // Send Email
        const mailOptions = {
            from: `"SHIV SHAKTI BOT" <${process.env.SENDER_EMAIL}>`,
            to: email,
            subject: `🌸 YOUR VERIFICATION CODE: ${code}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 2px solid #ff0080; border-radius: 20px; max-width: 400px;">
                    <h1 style="color: #ff0080; text-align: center;">Shiv Shakti Store 🌸</h1>
                    <p style="font-size: 16px; color: #333;">Hello!</p>
                    <p style="font-size: 16px; color: #333;">Use the code below to verify your account and start your glow journey:</p>
                    <div style="background: #fff0f6; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 40px; font-weight: 900; letter-spacing: 10px; color: #ff0080;">${code}</span>
                    </div>
                    <p style="font-size: 12px; color: #999; text-align: center;">If you didn't request this, please ignore this email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`📧 Code ${code} sent to ${email}`);
        res.json({ message: 'Code sent to your email! ✅' });

    } catch (err) {
        console.error('❌ SEND CODE ERROR:', err);
        res.status(400).json({ message: 'Error sending code: ' + err.message });
    }
});

// 2. Signup / Verify Code
router.post('/signup', async (req, res) => {
    try {
        let { name, email, password, phone, code } = req.body;
        email = email.trim().toLowerCase();

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Please request a code first.' });

        if (user.verificationCode !== code) {
            return res.status(400).json({ message: 'Invalid verification code.' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.name = name;
        user.phone = phone;
        user.isVerified = true;
        user.verificationCode = ''; // Clear code after use

        const isAdmin = email === (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
        user.isAdmin = isAdmin;

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

        if (!user.isVerified && user.password !== 'temp') {
            return res.status(400).json({ message: 'Please verify your email before logging in.' });
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
