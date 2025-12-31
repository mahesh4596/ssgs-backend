const express = require('express');
const router = express.Router();
const User = require('../models/User');
const nodemailer = require('nodemailer');

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

// Temporary memory store for OTPs (In a big app, use Redis or Database)
const otpStore = {};

// 1. SEND OTP ROUTE
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required' });

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store in memory with 5-minute expiry
        otpStore[email] = {
            otp,
            expires: Date.now() + 5 * 60 * 1000
        };

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
        console.log(`✅ OTP sent to ${email}: ${otp}`);
        res.json({ message: 'Verification code sent to email!' });
    } catch (err) {
        console.error('❌ OTP ERROR DETAILS:', err);
        res.status(500).json({ message: 'Error sending verification code', error: err.message });
    }
});

// Update Signup to check OTP
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password, phone, otp } = req.body;

        // Check OTP
        const record = otpStore[email];
        if (!record || record.otp !== otp) {
            return res.status(400).json({ message: 'Invalid code. Please request a new one.' });
        }
        if (Date.now() > record.expires) {
            delete otpStore[email];
            return res.status(400).json({ message: 'Code expired. Please request a new one.' });
        }

        // Clean memory
        delete otpStore[email];

        console.log('Attempting signup for:', email);
        const isAdmin = email.trim().toLowerCase() === (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
        const user = new User({ name, email: email.trim(), password, phone, isAdmin });
        await user.save();

        res.json({ message: 'User created!', user });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'User already exists.' });
        res.status(400).json({ message: 'Error creating user', error: err.message });
    }
});

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt for:', email.trim());
        const user = await User.findOne({ email: email.trim(), password });
        if (user) {
            console.log('User found in DB:', user.email);
            // Also check Admin status on login to handle accounts created before the change
            const isAdminEmail = email.trim().toLowerCase() === (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
            console.log('Admin email match:', isAdminEmail);
            if (isAdminEmail && !user.isAdmin) {
                user.isAdmin = true;
                await user.save();
                console.log('User upgraded to Admin');
            }
            res.json({ message: 'Login success!', user });
        } else {
            console.log('Login failed: Email or password incorrect for', email.trim());
            // Check if user even exists
            const existingUser = await User.findOne({ email: email.trim() });
            if (!existingUser) {
                console.log('Reason: User does not exist in database.');
            } else {
                console.log('Reason: Password does not match.');
            }
            res.status(400).json({ message: 'Invalid email or password' });
        }
    } catch (err) {
        console.error('Login Error:', err.message);
        res.status(400).json({ message: 'Error logging in', error: err.message });
    }
});

// Google Login
router.post('/google-login', async (req, res) => {
    try {
        const { token } = req.body;
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const { name, email, picture } = ticket.getPayload();

        let user = await User.findOne({ email: email.toLowerCase() });
        const isAdmin = email.trim().toLowerCase() === (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

        if (!user) {
            // Create user if not exists (using a random password for social login users)
            user = new User({
                name,
                email: email.toLowerCase(),
                password: Math.random().toString(36).slice(-8),
                isAdmin
            });
            await user.save();
        } else if (isAdmin && !user.isAdmin) {
            user.isAdmin = true;
            await user.save();
        }

        res.json({ message: 'Login success!', user });
    } catch (err) {
        console.error('Login Error:', err.message);
        res.status(400).json({ message: 'Error logging in', error: err.message });
    }
});

// Update Profile (Phone)
router.post('/update-profile', async (req, res) => {
    try {
        const { userId, phone, password } = req.body;
        const user = await User.findById(userId);
        if (user) {
            if (phone) user.phone = phone;
            if (password) user.password = password; // In a real app, hash this!
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
