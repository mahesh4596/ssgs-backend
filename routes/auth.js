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

        // Send Email
        const mailOptions = {
            from: `"SHIV SHAKTI" <${process.env.SENDER_EMAIL}>`,
            to: email,
            subject: `🌸 OTP: ${code}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 2px solid #ff0080; border-radius: 20px; max-width: 400px; margin: auto;">
                    <h1 style="color: #ff0080; text-align: center;">Shiv Shakti Store 🌸</h1>
                    <p style="font-size: 16px; color: #333; text-align: center;">Your verification code is:</p>
                    <div style="background: #fff0f6; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 40px; font-weight: 900; letter-spacing: 10px; color: #ff0080;">${code}</span>
                    </div>
                    <p style="font-size: 12px; color: #999; text-align: center;">Use this code to complete your registration.</p>
                </div>
            `
        };

        // --- ATTEMPT SENDING FIRST ---
        await transporter.sendMail(mailOptions);

        // --- ONLY SAVE TO DB IF EMAIL SUCCEEDS ---
        await user.save();

        console.log(`📧 Code ${code} sent to ${email} AND saved to DB! ✅`);
        res.json({ message: 'Code sent to your email! ✅' });

    } catch (err) {
        console.error('❌ SEND CODE ERROR:', err);
        res.status(400).json({ message: 'Error sending code: ' + (err.message.includes('timeout') ? 'Network Timeout. Please try again in 5 seconds.' : err.message) });
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

        // Only block if we explicitly know they are unverified AND it's a temporary signup doc
        if (user.isVerified === false && user.password === 'temp') {
            return res.status(400).json({ message: 'Account not verified. Please use the verification code sent to your email during signup.' });
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
