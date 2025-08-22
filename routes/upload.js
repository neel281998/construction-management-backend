const express = require('express');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 
      'image/jpeg,image/png,image/jpg,application/pdf').split(',');
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Initialize GridFS
let gfsBucket;
mongoose.connection.once('open', () => {
  gfsBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

// Upload single file
router.post('/single', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const { category = 'general', description = '' } = req.body;
    
    // Create upload stream
    const uploadStream = gfsBucket.openUploadStream(req.file.originalname, {
      metadata: {
        uploadedBy: req.user._id,
        uploadedAt: new Date(),
        category,
        description,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });
    
    // Handle upload completion
    uploadStream.on('finish', () => {
      res.json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          fileId: uploadStream.id,
          filename: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          category,
          uploadedAt: new Date()
        }
      });
    });
    
    // Handle upload error
    uploadStream.on('error', (error) => {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: 'File upload failed'
      });
    });
    
    // Write file to GridFS
    uploadStream.end(req.file.buffer);
    
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed'
    });
  }
});

// Upload multiple files
router.post('/multiple', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }
    
    const { category = 'general', description = '' } = req.body;
    const uploadedFiles = [];
    
    // Upload each file
    for (const file of req.files) {
      const uploadStream = gfsBucket.openUploadStream(file.originalname, {
        metadata: {
          uploadedBy: req.user._id,
          uploadedAt: new Date(),
          category,
          description,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size
        }
      });
      
      // Wait for upload to complete
      await new Promise((resolve, reject) => {
        uploadStream.on('finish', () => {
          uploadedFiles.push({
            fileId: uploadStream.id,
            filename: file.originalname,
            size: file.size,
            mimeType: file.mimetype
          });
          resolve();
        });
        
        uploadStream.on('error', reject);
        uploadStream.end(file.buffer);
      });
    }
    
    res.json({
      success: true,
      message: `${uploadedFiles.length} files uploaded successfully`,
      data: {
        files: uploadedFiles,
        category,
        uploadedAt: new Date()
      }
    });
    
  } catch (error) {
    console.error('Upload multiple files error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed'
    });
  }
});

// Download file
router.get('/download/:fileId', authenticateToken, async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    
    // Check if file exists
    const files = await gfsBucket.find({ _id: fileId }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    const file = files[0];
    
    // Set appropriate headers
    res.set({
      'Content-Type': file.metadata.mimeType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Length': file.length
    });
    
    // Create download stream
    const downloadStream = gfsBucket.openDownloadStream(fileId);
    
    downloadStream.on('error', (error) => {
      console.error('Download error:', error);
      res.status(500).json({
        success: false,
        message: 'File download failed'
      });
    });
    
    // Pipe file to response
    downloadStream.pipe(res);
    
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({
      success: false,
      message: 'File download failed'
    });
  }
});

// Get file info
router.get('/info/:fileId', authenticateToken, async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    
    const files = await gfsBucket.find({ _id: fileId }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    const file = files[0];
    
    res.json({
      success: true,
      data: {
        fileId: file._id,
        filename: file.filename,
        size: file.length,
        mimeType: file.metadata.mimeType,
        uploadedBy: file.metadata.uploadedBy,
        uploadedAt: file.metadata.uploadedAt,
        category: file.metadata.category,
        description: file.metadata.description
      }
    });
    
  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file information'
    });
  }
});

// Delete file
router.delete('/:fileId', authenticateToken, async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    
    // Check if file exists
    const files = await gfsBucket.find({ _id: fileId }).toArray();
    
    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    const file = files[0];
    
    // Check permissions (only uploader or admin can delete)
    if (file.metadata.uploadedBy.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    await gfsBucket.delete(fileId);
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

module.exports = router;