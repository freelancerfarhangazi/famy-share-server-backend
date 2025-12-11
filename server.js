// Load environment variables (Cloudinary keys) from .env file
require('dotenv').config(); 

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const https = require('https'); 

const app = express();
const port = 3000;

// --- 1. CLOUDINARY CONFIGURATION ---
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
});

// --- 2. MULTER CONFIGURATION (Memory Storage) ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// --- Middleware ---
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); 
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Helper Function
function generateUniqueId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// --- MOCK DATABASE (To track unique IDs and their Cloudinary URLs) ---
// This is the database that stores the link between uniqueId and the Cloudinary URL.
const mockDatabase = {};

// 🚨 Hardcoded Test File: This permanent entry is essential for the /PERMTEST download to work reliably.
mockDatabase['PERMTEST'] = {
    fileName: 'Test_File_From_Cloudinary.jpg', 
    fileUrl: 'https://res.cloudinary.com/djv2fivzd/image/upload/v1765457264/famy_share_uploads/somtbvanr2vv0gzwktro.png', // <<< REPLACE THIS URL WITH A PERMANENT URL FROM YOUR OWN CLOUDINARY ACCOUNT
}; 


// --- DOWNLOAD ROUTE (FIXED: Uses mockDatabase) ---
app.get('/:uniqueId', async (req, res) => {
    const uniqueId = req.params.uniqueId;
    console.log(`Received GET request for download ID: ${uniqueId}`);

    // 1. Look up the file URL in the mock database
    const fileData = mockDatabase[uniqueId];

    if (!fileData || !fileData.fileUrl) {
        console.error(`Download failed: ID ${uniqueId} not found in mockDatabase.`);
        return res.status(404).send('File not found or link has expired.');
    }
    
    const actualFileUrl = fileData.fileUrl;
    const actualFileName = fileData.fileName;
    
    // --- DEBUGGING: Print the URL to confirm it's valid ---
    console.log(`Attempting to fetch from Cloudinary: ${actualFileUrl}`);
    
    // 1. Set the correct headers
    res.set({
        'Content-Disposition': `attachment; filename="${actualFileName}"`, 
        'Content-Type': 'application/octet-stream', 
    });

    try {
        // 2. Stream the file from the remote URL (Cloudinary) to the user's browser
        // We use https.get because the Cloudinary URL is HTTPS
        https.get(actualFileUrl, (stream) => { 
            // Add error handling on the stream itself
            stream.on('error', (err) => {
                 console.error('Stream Error (Source):', err.message);
                 res.destroy(); 
            });
            stream.pipe(res);
            
        }).on('error', (err) => {
            console.error('Request Error (Target):', err.message);
            res.status(500).send('Error retrieving file from storage (Request failed).');
        });
        
    } catch (error) {
        console.error('Download processing error:', error);
        res.status(500).send('Download link is broken or file has expired.');
    }
});


// --- UPLOAD ROUTE (FIXED: Saves to mockDatabase) ---
app.post('/upload', upload.single('sharedFiles'), async (req, res) => {
    console.log('Received POST request at /upload. Processing file...');
    
    if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No file received.' });
    }

    try {
        // Correct Base64 conversion
        let dataURI = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

        // Upload to Cloudinary
        const cloudinaryResponse = await cloudinary.uploader.upload(dataURI, {
            resource_type: "auto", 
            folder: "famy_share_uploads" 
        });
        
        // --- Dynamic Link Generation and Database Storage ---

        const uniqueId = generateUniqueId();
        const uploadedFileName = req.file.originalname;
        const publicFileUrl = cloudinaryResponse.secure_url; 
        
        // ** CRITICAL: Save the data to the mock in-memory database **
        mockDatabase[uniqueId] = {
            fileName: uploadedFileName,
            fileUrl: publicFileUrl,
        };

        console.log(`File uploaded to Cloudinary: ${publicFileUrl}. Stored as ID: ${uniqueId}`);

        // Send a success response back to the frontend
        res.status(200).json({
            status: 'success',
            uniqueId: uniqueId, 
            fileName: uploadedFileName,
            fileUrl: publicFileUrl
        });

    } catch (error) {
        console.error('Cloudinary Upload Failed:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Server failed to process and save the file.' 
        });
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Famy Share Server listening at http://localhost:${port}`);
});