const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1 * 1024 * 1024
    }
});

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

const fileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
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

app.get('/', (req, res) => {
    res.json({ 
        message: '🚀 File Share API is running!',
        endpoints: {
            upload: 'POST /api/upload',
            download: 'POST /api/download'
        }
    });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
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

        const existingFile = await File.findOne({ name });
        if (existingFile) {
            return res.status(400).json({ error: 'File name already exists. Choose a different name.' });
        }

        const hashedCode = await bcrypt.hash(code, 10);

        const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        
        const uploadResponse = await cloudinary.uploader.upload(fileStr, {
            resource_type: 'auto',
            folder: 'file-share-app'
        });

        const newFile = new File({
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

app.post('/api/download', async (req, res) => {
    try {
        const { name, code } = req.body;

        if (!name || !code) {
            return res.status(400).json({ error: 'Name and code are required' });
        }

        const file = await File.findOne({ name });

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

app.get('/api/stats', async (req, res) => {
    try {
        const totalFiles = await File.countDocuments();
        const files = await File.find({}, 'fileSize');
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

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
});