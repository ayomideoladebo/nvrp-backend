const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "password"; // IMPORTANT: Change this in a real application

// --- MIDDLEWARE ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files

// --- STORAGE FOR UPLOADS (using Multer) ---
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb){
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits:{fileSize: 5000000}, // 5MB limit
    fileFilter: function(req, file, cb){
        checkFileType(file, cb);
    }
}).single('screenshot');

function checkFileType(file, cb){
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if(mimetype && extname){
        return cb(null,true);
    } else {
        cb('Error: Images Only!');
    }
}

// --- DATABASE (JSON file for simplicity) ---
const DB_PATH = path.join(__dirname, 'donations.json');

function readDB() {
    if (!fs.existsSync(DB_PATH)) {
        return [];
    }
    const data = fs.readFileSync(DB_PATH);
    return JSON.parse(data);
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// --- API ROUTES ---

// Submit a new donation
app.post('/api/donations', (req, res) => {
    upload(req, res, (err) => {
        if(err){
            return res.status(400).json({ message: err });
        }
        if(req.file == undefined){
            return res.status(400).json({ message: 'Error: No File Selected!' });
        }

        const { tier, price, discordUser, inGameName } = req.body;
        if (!tier || !price || !discordUser || !inGameName) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const newDonation = {
            id: Date.now(),
            tier,
            price: `₦${parseInt(price).toLocaleString()}`,
            discordUser,
            inGameName,
            screenshotUrl: `/uploads/${req.file.filename}`,
            date: new Date().toLocaleString(),
            status: 'pending'
        };

        const donations = readDB();
        donations.unshift(newDonation); // Add to the beginning
        writeDB(donations);

        res.status(201).json({ message: 'Donation submitted successfully!', donation: newDonation });
    });
});

// Admin login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Get all donations (for admin)
app.get('/api/donations', (req, res) => {
    const donations = readDB();
    res.json(donations);
});

// Update donation status (for admin)
app.put('/api/donations/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['pending', 'processed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status.' });
    }

    const donations = readDB();
    const donationIndex = donations.findIndex(d => d.id == id);

    if (donationIndex > -1) {
        donations[donationIndex].status = status;
        writeDB(donations);
        res.json({ message: 'Status updated successfully', donation: donations[donationIndex] });
    } else {
        res.status(404).json({ message: 'Donation not found.' });
    }
});

// --- SERVE FRONTEND (for a complete project structure) ---
// If your frontend files are in a 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- START SERVER ---
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));