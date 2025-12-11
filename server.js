// Load environment variables (Cloudinary keys) from .env file
require('dotenv').config(); 

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const https = require('https'); // Import the HTTPS module for the download route

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

// --- DOWNLOAD ROUTE (FIXED) ---
// This handles requests like: http://localhost:3000/xYIZ2Tgh
app.get('/:uniqueId', async (req, res) => {
    const uniqueId = req.params.uniqueId;
    console.log(`Received GET request for download ID: ${uniqueId}`);

    // --- MOCK DATABASE LOOKUP and File URL ---
    // NOTE: For a real test, this URL MUST be the working Cloudinary link for the file you uploaded.
    const mockFileUrl = "https://res.cloudinary.com/djv2fivzd/image/upload/v1765457264/famy_share_uploads/somtbvanr2vv0gzwktro.png"; 

    
    // --- NEW LOGIC: Extract the correct filename from the URL ---
    // 1. Split the URL by '/' to get the parts
    const urlParts = mockFileUrl.split('/');
    // 2. The filename is the last part of the URL (e.g., somtbvanr2vv0gzwktro.png)
    const actualFileName = urlParts[urlParts.length - 1]; 
    
    
    // --- File Download Logic ---
    
    // 1. Set the correct headers using the extracted filename!
    res.set({
        // IMPORTANT: Use the extracted filename with its correct extension
        'Content-Disposition': `attachment; filename="${actualFileName}"`, 
        'Content-Type': 'application/octet-stream', // Generic stream type is fine now
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


// --- UPLOAD ROUTE (The New Logic) ---

// 'upload.single('sharedFiles')' is the middleware that processes the file data
app.post('/upload', upload.single('sharedFiles'), async (req, res) => {
    console.log('Received POST request at /upload. Processing file...');
    
    // Check if a file was successfully attached by multer
    if (!req.file) {
        return res.status(400).json({ status: 'error', message: 'No file received.' });
    }

    try {
        // --- Core File Handling ---
        
        // Convert the buffer (file data) into a base64 string for upload
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

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