// ============================================
// IMPORT REQUIRED PACKAGES
// ============================================
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

// Import Models
const User = require('./models/User');

// ============================================
// INITIALIZE EXPRESS APP
// ============================================
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE SETUP
// ============================================
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));

// ============================================
// CLOUDINARY CONFIGURATION
// ============================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ============================================
// MULTER CONFIGURATION
// ============================================
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1 * 1024 * 1024
    }
});

// ============================================
// MONGODB CONNECTION
// ============================================
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// ============================================
// FILE SCHEMA (Updated with userId)
// ============================================
const fileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    fileType: {
        type: String,
        required: true
    },
    cloudinaryUrl: {
        type: String,
        required: true
    },
    cloudinaryPublicId: {
        type: String,
        required: true
    },
    uploadDate: {
        type: Date,
        default: Date.now
    }
});

const File = mongoose.model('File', fileSchema);

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
const authenticateUser = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// ============================================
// AUTH ROUTES
// ============================================

// Test Route
app.get('/', (req, res) => {
    res.json({ 
        message: '🚀 File Share API with Authentication is running!',
        endpoints: {
            signup: 'POST /api/auth/signup',
            login: 'POST /api/auth/login',
            upload: 'POST /api/upload (requires auth)',
            download: 'POST /api/download (requires auth)'
        }
    });
});

// SIGNUP ROUTE
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { pin } = req.body;

        // Validate PIN
        if (!pin || pin.length < 4 || pin.length > 6) {
            return res.status(400).json({ error: 'PIN must be 4-6 digits' });
        }

        // Check if only digits
        if (!/^\d+$/.test(pin)) {
            return res.status(400).json({ error: 'PIN must contain only numbers' });
        }

        // Check if PIN already exists
        const existingUser = await User.findOne({ pin: await bcrypt.hash(pin, 10) });
        
        // Create new user
        const user = new User({ pin });
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            token,
            userId: user._id
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'This PIN is already taken. Please choose another.' });
        }
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// LOGIN ROUTE
app.post('/api/auth/login', async (req, res) => {
    try {
        const { pin } = req.body;

        if (!pin) {
            return res.status(400).json({ error: 'PIN is required' });
        }

        // Find all users and check PIN (since PIN is hashed)
        const users = await User.find();
        let matchedUser = null;

        for (const user of users) {
            const isMatch = await user.comparePin(pin);
            if (isMatch) {
                matchedUser = user;
                break;
            }
        }

        if (!matchedUser) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: matchedUser._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful!',
            token,
            userId: matchedUser._id
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ============================================
// FILE ROUTES (PROTECTED)
// ============================================

// UPLOAD ROUTE
app.post('/api/upload', authenticateUser, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { name, code } = req.body;

        if (!name || !code) {
            return res.status(400).json({ error: 'Name and code are required' });
        }

        if (code.length < 4 || code.length > 6) {
            return res.status(400).json({ error: 'Code must be 4-6 characters' });
        }

        // Check if name already exists for THIS USER
        const existingFile = await File.findOne({ name, userId: req.userId });
        if (existingFile) {
            return res.status(400).json({ error: 'You already have a file with this name. Choose a different name.' });
        }

        const hashedCode = await bcrypt.hash(code, 10);

        const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        
        const uploadResponse = await cloudinary.uploader.upload(fileStr, {
            resource_type: 'auto',
            folder: 'file-share-app'
        });

        const newFile = new File({
            userId: req.userId,
            name: name,
            code: hashedCode,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            fileType: req.file.mimetype,
            cloudinaryUrl: uploadResponse.secure_url,
            cloudinaryPublicId: uploadResponse.public_id
        });

        await newFile.save();

        res.status(201).json({
            success: true,
            message: 'File uploaded successfully!',
            data: {
                name: newFile.name,
                fileName: newFile.fileName,
                fileSize: newFile.fileSize,
                uploadDate: newFile.uploadDate
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            error: 'Failed to upload file',
            details: error.message 
        });
    }
});

// DOWNLOAD ROUTE
app.post('/api/download', authenticateUser, async (req, res) => {
    try {
        const { name, code } = req.body;

        if (!name || !code) {
            return res.status(400).json({ error: 'Name and code are required' });
        }

        // Find file that belongs to THIS USER
        const file = await File.findOne({ name, userId: req.userId });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        const isCodeValid = await bcrypt.compare(code, file.code);

        if (!isCodeValid) {
            return res.status(401).json({ error: 'Invalid secret code' });
        }

        res.json({
            success: true,
            data: {
                fileName: file.fileName,
                fileSize: file.fileSize,
                fileType: file.fileType,
                downloadUrl: file.cloudinaryUrl,
                uploadDate: file.uploadDate
            }
        });

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve file',
            details: error.message 
        });
    }
});

// GET FILE STATS (for current user)
app.get('/api/stats', authenticateUser, async (req, res) => {
    try {
        const totalFiles = await File.countDocuments({ userId: req.userId });
        const files = await File.find({ userId: req.userId }, 'fileSize');
        const totalSize = files.reduce((sum, file) => sum + file.fileSize, 0);

        res.json({
            totalFiles,
            totalSize,
            totalSizeKB: (totalSize / 1024).toFixed(2)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
});