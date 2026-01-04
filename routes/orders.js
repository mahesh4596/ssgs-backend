const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const axios = require('axios'); // For Telegram


// Configure Email Transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS
    auth: {
        user: (process.env.SENDER_EMAIL || '').trim(),
        pass: (process.env.EMAIL_APP_PASSWORD || '').trim()
    },
    tls: {
        rejectUnauthorized: false,
        minVersion: "TLSv1.2"
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 45000
});

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ ORDER EMAIL ERROR:', error.message);
    } else {
        console.log('📧 Order Email Engine [Port 465/SSL] is Active! ✅');
    }
});

// Create order
router.post('/', async (req, res) => {
    try {
        const order = new Order(req.body);
        await order.save();

        // Fetch full document with populated user for reliable logs
        const fullOrder = await Order.findById(order._id).populate('user');

        // --- STEP 1: BRAIN-FRIENDLY TERMINAL LOG (Detailed) ---
        console.log('\n\n--- 🌸 NEW ORDER ALERT 🌸 ---');
        console.log(`🆔 Order ID: ${fullOrder._id}`);
        console.log(`👤 Customer: ${fullOrder.user?.name || 'Walk-in'} (${fullOrder.user?.email || 'N/A'})`);
        console.log(`📞 Phone: ${fullOrder.phone || 'N/A'}`);
        console.log(`🏠 Address: ${fullOrder.address}`);
        console.log(`💰 Total: ₹${fullOrder.totalAmount}`);
        console.log(`📦 Items:`);
        fullOrder.items.forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.name} (Qty: ${item.quantity}) - ₹${item.price}`);
        });
        console.log('-------------------------------\n\n');

        // --- STEP 2: TELEGRAM NOTIFICATION ---
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            const chatId = process.env.TELEGRAM_CHAT_ID;
            const message = `🚨 *NEW ORDER RECEIVED* 🚨\n\n🆔 *Order ID:* \`${fullOrder._id}\`\n👤 *Customer:* ${fullOrder.user?.name || 'N/A'}\n📞 *Phone:* ${fullOrder.phone || 'N/A'}\n🏠 *Address:* ${fullOrder.address}\n💰 *Total:* ₹${fullOrder.totalAmount}\n\n📦 *Items:* \n${fullOrder.items.map(i => `• ${i.name} (x${i.quantity})`).join('\n')}`;

            axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'
            }).then(() => {
                console.log('📱 Telegram Notification Sent! ✅');
            }).catch(err => {
                console.error('❌ Telegram Failed:', err.response?.data || err.message);
            });
        }

        // --- STEP 3: EMAIL NOTIFICATION ---
        if (process.env.EMAIL_APP_PASSWORD && process.env.EMAIL_APP_PASSWORD !== 'your_gmail_app_password_here') {

            const mailOptions = {
                from: `"SHIV SHAKTI BOT" <${process.env.SENDER_EMAIL}>`,
                to: process.env.ADMIN_EMAIL, // The email that RECEIVES the alert
                subject: `🚨 NEW ORDER RECEIVED: #${fullOrder._id.toString().slice(-6)}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ff0080; border-radius: 20px;">
                        <h1 style="color: #ff0080;">Shiv Shakti Store Alert! 🌸</h1>
                        <p>Hello Admin, a new masterpiece has been ordered!</p>
                        <hr/>
                        <p><strong>Order ID:</strong> #${fullOrder._id}</p>
                        <p><strong>Customer Name:</strong> ${fullOrder.user?.name || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${fullOrder.phone || 'N/A'}</p>
                        <p><strong>Total Amount:</strong> ₹${fullOrder.totalAmount}</p>
                        <p><strong>Shipping Address:</strong> ${fullOrder.address}</p>
                        <hr/>
                        <p style="color: #888; font-size: 10px;">Check your Boutique Console for full order details.</p>
                    </div>
                `
            };



            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('❌ EMAIL ERROR:', error.message);
                    console.log('💡 TIP: Make sure you use a 16-character "App Password", not your normal Gmail password.');
                } else {
                    console.log('📧 Admin notified via Email! ✅');
                }
            });
        } else {
            console.log('⚠️ EMAIL SKIPPED: EMAIL_APP_PASSWORD is not set in .env');
        }

        res.json({ message: 'Order created!', order });
    } catch (err) {
        res.status(400).json({ message: 'Error creating order', error: err.message });
    }
});

// Get user orders
router.get('/user/:userId', async (req, res) => {
    try {
        const orders = await Order.find({ user: req.params.userId }).sort({ date: -1 });
        res.json(orders);
    } catch (err) {
        res.status(400).json({ message: 'Error fetching orders', error: err.message });
    }
});

// Get all orders (Admin)
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find().populate('user', 'name email').sort({ date: -1 });
        res.json(orders);
    } catch (err) {
        res.status(400).json({ message: 'Error fetching all orders', error: err.message });
    }
});

// Update order payment status (Admin)
router.patch('/:id/payment-status', async (req, res) => {
    try {
        const { paymentStatus } = req.body;
        const order = await Order.findByIdAndUpdate(req.params.id, { paymentStatus }, { new: true });
        res.json({ message: 'Status Updated', order });
    } catch (err) {
        res.status(400).json({ message: 'Error updating status', error: err.message });
    }
});

module.exports = router;
