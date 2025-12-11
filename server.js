// Load environment variables (Cloudinary keys) from .env file
require('dotenv').config(); 

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const https = require('https'); // <<< FIX 1: Essential for the download route

const app = express();
const port = 3000;

// --- 1. CLOUDINARY CONFIGURATION ---
// This connects the application to your free Cloudinary account
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
});

// --- 2. MULTER CONFIGURATION (Memory Storage) ---
// This tells multer to temporarily store the file in server memory 
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// --- Middleware ---

// Enable CORS for frontend communication
app.use((req, res, next) => {
    // This allows your frontend (even if local) to talk to the Render server
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

// --- DOWNLOAD ROUTE (FINAL FIXES) ---
// This handles requests like: https://famy-share-server-backend.onrender.com/xYIZ2Tgh
app.get('/:uniqueId', async (req, res) => {
    const uniqueId = req.params.uniqueId;
    console.log(`Received GET request for download ID: ${uniqueId}`);

    // --- MOCK DATABASE LOOKUP and File URL ---
    // NOTE: Replace this mock URL with the URL of the last file you successfully uploaded
    // (e.g., https://res.cloudinary.com/djv2fivzd/image/upload/v1765457264/famy_share_uploads/somtbvanr2vv0gzwktro.png)
    const mockFileUrl = "https://res.cloudinary.com/djv2fivzd/image/upload/v1765457264/famy_share_uploads/somtbvanr2vv0gzwktro.png"; 

    
    // --- Extract the correct filename from the URL for the download header ---
    const urlParts = mockFileUrl.split('/');
    const actualFileName = urlParts[urlParts.length - 1]; 
    
    
    // --- File Download Logic ---
    
    // 1. Set the correct headers using the extracted filename!
    res.set({
        // FIX 3: Ensures correct extension is used by extracting the name from the URL
        'Content-Disposition': `attachment; filename="${actualFileName}"`, 
        'Content-Type': 'application/octet-stream', 
    });

    try {
        // 2. Stream the file from the remote URL (Cloudinary) to the user's browser
        https.get(mockFileUrl, (stream) => {
            // Pipe the stream directly to the response, starting the download
            stream.pipe(res);
        }).on('error', (err) => {
            console.error('Error fetching file from Cloudinary:', err.message);
            res.status(500).send('Error retrieving file from storage.');
        });
        
    } catch (error) {
        console.error('Download processing error:', error);
        res.status(500).send('Download link is broken or file has expired.');
    }
});


// --- UPLOAD ROUTE (FINAL FIXES) ---
app.post('/upload', upload.single('sharedFiles'), async (req, res) => {
    console.log('Received POST request at /upload. Processing file...');
    
    // Check if a file was successfully attached by multer
    if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No file received.' });
    }

    try {
        // --- Core File Handling ---
        
        // FIX 2: This robust line prevents the "ENOENT" error by properly formatting the Data URI
        let dataURI = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

        // Upload to Cloudinary
        const cloudinaryResponse = await cloudinary.uploader.upload(dataURI, {
            resource_type: "auto", // Automatically detect file type
            folder: "famy_share_uploads" // Group uploads in a specific folder
        });
        
        // --- Dynamic Link Generation and Response ---

        const uniqueId = generateUniqueId();
        const uploadedFileName = req.file.originalname;
        const publicFileUrl = cloudinaryResponse.secure_url; // This is the public URL on Cloudinary

        console.log(`File uploaded to Cloudinary: ${publicFileUrl}`);

        // TODO: In a real app, save uniqueId, uploadedFileName, and publicFileUrl to a DATABASE here!

        // Send a success response back to the frontend
        res.status(200).json({
            status: 'success',
            uniqueId: uniqueId, 
            fileName: uploadedFileName, // Send the real file name
            fileUrl: publicFileUrl     // Send the public URL (optional for now)
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