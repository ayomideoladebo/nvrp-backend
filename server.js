const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const ADMIN_USERNAME = "adminnvrp";
const ADMIN_PASSWORD = "password1234"; // IMPORTANT: Change this in a real application

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- STORAGE FOR UPLOADS (Multer) ---
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb('Error: Images Only!');
    }
}).single('screenshot');

// --- DATABASE FUNCTIONS (JSON files for simplicity) ---
const DONATIONS_DB_PATH = path.join(__dirname, 'donations.json');
const WAITLIST_DB_PATH = path.join(__dirname, 'waitlist.json');

function readDB(filePath) {
    if (!fs.existsSync(filePath)) return [];
    try {
        const data = fs.readFileSync(filePath);
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

function writeDB(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// --- API ROUTES ---

// Admin login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Submit a new donation
app.post('/api/donations', (req, res) => {
    upload(req, res, (err) => {
        if (err) return res.status(400).json({ message: err });
        if (!req.file) return res.status(400).json({ message: 'Error: No File Selected!' });

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
            date: new Date().toISOString(),
            status: 'pending'
        };

        const donations = readDB(DONATIONS_DB_PATH);
        donations.unshift(newDonation);
        writeDB(DONATIONS_DB_PATH, donations);
        res.status(201).json({ message: 'Donation submitted successfully!', donation: newDonation });
    });
});

// Get all donations (for admin)
app.get('/api/donations', (req, res) => {
    const donations = readDB(DONATIONS_DB_PATH);
    res.json(donations);
});

// Update donation status (for admin)
app.put('/api/donations/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['pending', 'processed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status.' });
    }
    const donations = readDB(DONATIONS_DB_PATH);
    const donationIndex = donations.findIndex(d => d.id == id);
    if (donationIndex > -1) {
        donations[donationIndex].status = status;
        writeDB(DONATIONS_DB_PATH, donations);
        res.json({ message: 'Status updated successfully', donation: donations[donationIndex] });
    } else {
        res.status(404).json({ message: 'Donation not found.' });
    }
});

// Submit a new waitlist application
app.post('/api/waitlist', (req, res) => {
    const { discordUser, inGameName, age, rpDefinition, powergaming, backstory } = req.body;
    if (!discordUser || !inGameName || !age || !rpDefinition || !powergaming || !backstory) {
        return res.status(400).json({ message: 'All application fields are required.' });
    }

    const newApplication = {
        id: Date.now(),
        date: new Date().toISOString(),
        ...req.body
    };

    const waitlist = readDB(WAITLIST_DB_PATH);
    waitlist.unshift(newApplication);
    writeDB(WAITLIST_DB_PATH, waitlist);
    res.status(201).json({ message: 'Application submitted successfully!' });
});

// Get all waitlist applications (for admin)
app.get('/api/waitlist', (req, res) => {
    const waitlist = readDB(WAITLIST_DB_PATH);
    res.json(waitlist);
});

// Get dashboard stats (for admin)
app.get('/api/dashboard-stats', (req, res) => {
    const donations = readDB(DONATIONS_DB_PATH);
    const waitlist = readDB(WAITLIST_DB_PATH);
    const today = new Date().toISOString().slice(0, 10);

    const playersToday = waitlist.filter(player => player.date.slice(0, 10) === today).length;

    const stats = {
        totalPlayers: waitlist.length,
        playersToday: playersToday,
        totalDonations: donations.length,
        pendingDonations: donations.filter(d => d.status === 'pending').length
    };
    res.json(stats);
});


// --- START SERVER ---
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));