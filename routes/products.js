const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'ssgs_products',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    },
});

const upload = multer({ storage: storage });

// Get all products
router.get('/', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        res.status(400).json({ message: 'Error fetching products', error: err.message });
    }
});

// Get single product
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        res.json(product);
    } catch (err) {
        res.status(400).json({ message: 'Error fetching product', error: err.message });
    }
});

// Add product (Admin) - Supports multiple uploads
router.post('/', upload.array('imageFiles', 5), async (req, res) => {
    try {
        const { name, price, description, category } = req.body;
        const images = [];

        // Handle uploaded files from Cloudinary
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => images.push(file.path));
            console.log(`☁️ Cloudinary Multi-Upload: ${images.length} images saved.`);
        }

        // Handle URL inputs (if any) - split by comma if multiple
        if (req.body.image) {
            const extraUrls = req.body.image.split(',').map(u => u.trim()).filter(u => u);
            images.push(...extraUrls);
        }

        if (images.length === 0) {
            return res.status(400).json({ message: 'Error: At least one image is required.' });
        }

        const product = new Product({
            name,
            price: Number(price) || 0,
            description,
            category,
            images
        });

        await product.save();
        res.json({ message: 'Product created with gallery!', product });
    } catch (err) {
        console.error('Multi-Product Add Error:', err);
        res.status(400).json({ message: 'Error: ' + err.message });
    }
});

// Delete product (Admin)
router.delete('/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Product deleted!' });
    } catch (err) {
        res.status(400).json({ message: 'Error deleting product', error: err.message });
    }
});

module.exports = router;
