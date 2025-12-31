const express = require('express');
const router = express.Router();
const User = require('../models/User');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

// Configure Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SENDER_EMAIL,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

// Verify connection configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ AUTH EMAIL CONNECTION FAILED:', error.message);
    } else {
        console.log('📧 Auth Email Server is ready! ✅');
    }
});

// Temporary memory store for OTPs
const otpStore = {};

// 1. SEND OTP ROUTE
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 };

        const mailOptions = {
            from: `"SHIV SHAKTI VERIFICATION" <${process.env.SENDER_EMAIL}>`,
            to: email,
            subject: '🌸 Your Verification Code for Shiv Shakti',
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 2px solid #ff0080; border-radius: 20px; text-align: center;">
                    <h1 style="color: #ff0080;">Welcome to Shiv Shakti!</h1>
                    <p style="font-size: 16px; color: #555;">Your secret code to create an account is:</p>
                    <div style="background: #fff0f6; padding: 20px; border-radius: 15px; display: inline-block;">
                        <span style="font-size: 32px; font-weight: 900; letter-spacing: 10px; color: #ff0080;">${otp}</span>
                    </div>
                    <p style="color: #888; font-size: 12px; margin-top: 20px;">This code will expire in 5 minutes.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: 'Verification code sent to email!' });
    } catch (err) {
        res.status(500).json({ message: 'Error sending verification code', error: err.message });
    }
});

// Signup with Hashing
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password, phone, otp } = req.body;

        const record = otpStore[email];
        if (!record || record.otp !== otp) {
            return res.status(400).json({ message: 'Invalid code. Please request a new one.' });
        }
        if (Date.now() > record.expires) {
            delete otpStore[email];
            return res.status(400).json({ message: 'Code expired.' });
        }

        delete otpStore[email];

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const isAdmin = email.trim().toLowerCase() === (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
        const user = new User({ name, email: email.trim(), password: hashedPassword, phone, isAdmin });
        await user.save();

        res.json({ message: 'User created!', user });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'User already exists.' });
        res.status(400).json({ message: 'Error creating user', error: err.message });
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
