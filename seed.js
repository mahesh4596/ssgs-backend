const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

const products = [
    {
        name: "Pink Velvet Lipstick",
        price: 499,
        image: "https://images.unsplash.com/photo-1586776977607-310e9c725c37?w=500&q=80",
        description: "A smooth, matte pink lipstick for a perfect look.",
        category: "Lipstick"
    },
    {
        name: "Rose Glow Blush",
        price: 799,
        image: "https://images.unsplash.com/photo-1596462502278-27bfdc4033c8?w=500&q=80",
        description: "Give your cheeks a natural rose glow.",
        category: "Blush"
    },
    {
        name: "Ocean Blue Eyeliner",
        price: 299,
        image: "https://images.unsplash.com/photo-1625093742435-6fa192b6fb10?w=500&q=80",
        description: "Waterproof eyeliner in a stunning ocean blue shade.",
        category: "Eyeliner"
    },
    {
        name: "Lavender Face Cream",
        price: 1299,
        image: "https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?w=500&q=80",
        description: "Soothing face cream with lavender extracts.",
        category: "Skincare"
    },
    {
        name: "Golden Shimmer Eyeshadow",
        price: 599,
        image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=500&q=80",
        description: "Sparkle all night with this golden eyeshadow.",
        category: "Eyeshadow"
    },
    {
        name: "Berry Lip Gloss",
        price: 349,
        image: "https://images.unsplash.com/photo-1599733589046-10c005739ef0?w=500&q=80",
        description: "Shiny berry gloss for juicy lips.",
        category: "Lipstick"
    },
    {
        name: "Elegant Pearl Necklace",
        price: 1499,
        image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500&q=80",
        description: "Beautiful pearl necklace for special occasions.",
        category: "Jewellery"
    },
    {
        name: "Crystal Drop Earrings",
        price: 899,
        image: "https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=500&q=80",
        description: "Sparkling crystal earrings to match any outfit.",
        category: "Jewellery"
    },
    {
        name: "Aloe Vera Facewash",
        price: 199,
        image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=500&q=80",
        description: "Gentle aloe vera facewash for all skin types.",
        category: "Facewash"
    },
    {
        name: "Charcoal Face Scrub",
        price: 299,
        image: "https://images.unsplash.com/photo-1556229162-5c63ed9c4efb?w=500&q=80",
        description: "Deep cleaning charcoal scrub for clear skin.",
        category: "Facewash"
    },
    {
        name: "Handmade Lavender Soap",
        price: 149,
        image: "https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=500&q=80",
        description: "Organic lavender soap for a soothing bath.",
        category: "Soap"
    },
    {
        name: "Saffron Glow Soap",
        price: 199,
        image: "https://images.unsplash.com/photo-1600857544200-b2f666a992ec?w=500&q=80",
        description: "Traditional saffron soap for glowing skin.",
        category: "Soap"
    }
];

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cosmetic-shop')
    .then(async () => {
        console.log('Connected to MongoDB for seeding');
        await Product.deleteMany();
        await Product.insertMany(products);
        console.log('Products seeded successfully!');
        process.exit();
    })
    .catch(err => {
        console.error('Seeding error:', err);
        process.exit(1);
    });
