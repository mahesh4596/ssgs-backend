const express = require('express');
const router = express.Router();
const User = require('../models/User');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

// Signup with Hashing
router.post('/signup', async (req, res) => {
    try {
        let { name, email, password, phone } = req.body;
        email = email.trim().toLowerCase(); // Normalize email

        console.log(`📝 Signup attempt for: ${email}`);

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const isAdmin = email.trim().toLowerCase() === (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
        const user = new User({ name, email: email.trim(), password: hashedPassword, phone, isAdmin });
        await user.save();

        res.json({ message: 'User created!', user });
    } catch (err) {
        console.error('❌ SIGNUP ERROR DETAILS:', err);
        if (err.code === 11000) return res.status(400).json({ message: 'This email is already registered. Please try logging in.' });
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
