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
const mongoURI = (process.env.MONGO_URI || "").trim();
const maskedURI = mongoURI ? mongoURI.replace(/\/\/.*@/, "//****:****@") : "MISSING";
console.log(`📡 DB Connection: ${maskedURI}`);

// MongoDB Listeners for Deep Debugging
mongoose.connection.on('error', err => {
  console.error('❌ MONGODB EVENT ERROR:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB Disconnected. Re-attempting...');
});

mongoose.connect(mongoURI, {
  serverSelectionTimeoutMS: 15000, // Slightly longer timeout for cold starts
})
  .then(() => console.log('✅ Connected to MongoDB Successfully!'))
  .catch(err => {
    console.error('❌ MONGODB INITIAL CONNECTION ERROR:');
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
  const fs = require('fs');
  const distPath = path.join(__dirname, '../frontend/dist');

  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    console.log('💡 Note: Frontend dist folder not found. Running as standalone API.');
  }
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
