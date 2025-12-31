const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
});

const crypto = require('crypto');

// Get Public Key
router.get('/key', (req, res) => {
    res.json({ key: process.env.RAZORPAY_KEY_ID });
});

// Create Razorpay Order
router.post('/create-order', async (req, res) => {
    try {
        const { amount } = req.body;
        console.log('Creating Razorpay order for amount:', amount);
        const options = {
            amount: Math.round(amount * 100), // amount in paise
            currency: 'INR',
            receipt: 'receipt_' + Math.random().toString(36).substring(7)
        };

        const order = await razorpay.orders.create(options);
        console.log('Razorpay order created successfully:', order.id);
        res.json(order);
    } catch (err) {
        console.error('RAZORPAY ERROR:', err);
        res.status(400).json({ message: 'Error creating Razorpay order', error: err.message });
    }
});

// Verify Payment Signature
router.post('/verify', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            return res.json({ message: "Payment verified successfully" });
        } else {
            return res.status(400).json({ message: "Invalid signature sent!" });
        }
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error!" });
    }
});

module.exports = router;
