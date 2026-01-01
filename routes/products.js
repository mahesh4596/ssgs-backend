const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for local storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
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

// Add product (Admin) - Supports both URL and File Upload
router.post('/', upload.single('imageFile'), async (req, res) => {
    try {
        const { name, price, description, category } = req.body;

        const productData = {
            name,
            price: Number(price) || 0, // Ensure price is a valid number
            description,
            category,
            image: req.body.image // default to URL if provided
        };

        // If an image file was uploaded, use the dynamic server host
        if (req.file) {
            const protocol = req.headers['x-forwarded-proto'] || 'https'; // Force https for Render
            const host = req.get('host');
            productData.image = `${protocol}://${host}/uploads/${req.file.filename}`;
            console.log(`🖼️ Image Uploaded: ${productData.image}`);
        }

        if (!productData.image) {
            return res.status(400).json({ message: 'Error: Image is required. Please select a file or paste a URL.' });
        }

        const product = new Product(productData);
        await product.save();
        res.json({ message: 'Product added!', product });
    } catch (err) {
        console.error('Add Product Error:', err);
        let errorMsg = err.message;
        if (err.name === 'ValidationError') {
            errorMsg = Object.values(err.errors).map(val => val.message).join(', ');
        }
        res.status(400).json({ message: 'Error: ' + errorMsg });
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
