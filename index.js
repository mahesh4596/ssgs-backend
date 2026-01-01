const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Setup
const rawURI = process.env.MONGO_URI || "";
const mongoURI = rawURI.trim(); // 🚀 FIX: Removes any accidental spaces from Render dashboard
const maskedURI = mongoURI ? mongoURI.replace(/\/\/.*@/, "//****:****@") : "MISSING";

console.log(`📡 DB Connection: ${maskedURI}`);

// Disable buffering so it fails fast instead of hanging
mongoose.set('bufferCommands', false);

mongoose.connect(mongoURI)
  .then(() => console.log('✅ Connected to MongoDB Successfully!'))
  .catch(err => {
    console.error('❌ MONGODB CONNECTION ERROR:');
    console.error(err.message);
  });

// Simple Route
app.get('/', (req, res) => {
  res.send('Cosmetic Shop Backend is running!');
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payment', require('./routes/payment'));

const PORT = process.env.PORT || 5000;

// Production setup (Only if you still want to serve frontend from backend)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*path', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
