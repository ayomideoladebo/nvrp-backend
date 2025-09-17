const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// --- IMPORTANT: REPLACE <db_password> WITH YOUR ACTUAL DATABASE PASSWORD ---
const MONGODB_URI = "mongodb+srv://nigeria-vibe-rp:Zxo6U9QOmJw1oReh@nigeria-vibe-rp.ldx39qg.mongodb.net/?retryWrites=true&w=majority&appName=nigeria-vibe-rp"; 
const DB_NAME = "nigeria-vibe-rp";

// --- DATABASE CONNECTION ---
let db;
async function connectToDb() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log("Successfully connected to MongoDB Atlas!");
    } catch (err) {
        console.error("Failed to connect to MongoDB", err);
        process.exit(1);
    }
}

// --- CONFIGURATION ---
const ADMIN_USERNAME = "adminnvrp";
const ADMIN_PASSWORD = "password1234";

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
    limits: { fileSize: 5000000 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb('Error: Images Only!');
    }
}).single('screenshot');

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
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ message: err });
        if (!req.file) return res.status(400).json({ message: 'Error: No File Selected!' });

        const { tier, price, discordUser, inGameName } = req.body;
        if (!tier || !price || !discordUser || !inGameName) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const newDonation = {
            tier,
            price: `₦${parseInt(price).toLocaleString()}`,
            discordUser,
            inGameName,
            screenshotUrl: `/uploads/${req.file.filename}`,
            date: new Date(), // Use JS Date object
            status: 'pending'
        };
        
        await db.collection('donations').insertOne(newDonation);
        res.status(201).json({ message: 'Donation submitted successfully!' });
    });
});

// Get all donations (for admin)
app.get('/api/donations', async (req, res) => {
    const donations = await db.collection('donations').find().sort({date: -1}).toArray();
    res.json(donations);
});

// Update donation status (for admin)
app.put('/api/donations/:id/status', async (req, res) => {
    const { ObjectId } = require('mongodb');
    const { id } = req.params;
    const { status } = req.body;

    // Basic validation for ID to prevent crashes
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid ID format.' });
    }

    try {
        const result = await db.collection('donations').updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: status } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Donation not found.' });
        }
        res.json({ message: 'Status updated successfully' });
    } catch (error) {
        console.error("Failed to update donation status:", error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});


// Submit a new waitlist application
app.post('/api/waitlist', async (req, res) => {
    const { discordUser, inGameName, age, rpDefinition, powergaming, backstory } = req.body;
    if (!discordUser || !inGameName || !age) {
        return res.status(400).json({ message: 'All application fields are required.' });
    }
    const newApplication = { date: new Date(), ...req.body };
    await db.collection('waitlist').insertOne(newApplication);
    res.status(201).json({ message: 'Application submitted successfully!' });
});

// Get all waitlist applications (for admin)
app.get('/api/waitlist', async (req, res) => {
    const waitlist = await db.collection('waitlist').find().sort({date: -1}).toArray();
    res.json(waitlist);
});

// Get dashboard stats (for admin)
app.get('/api/dashboard-stats', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const totalPlayers = await db.collection('waitlist').countDocuments();
        const playersToday = await db.collection('waitlist').countDocuments({ date: { $gte: today } });
        const totalDonations = await db.collection('donations').countDocuments();
        const pendingDonations = await db.collection('donations').countDocuments({ status: 'pending' });

        res.json({ totalPlayers, playersToday, totalDonations, pendingDonations });
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        res.status(500).json({ message: 'An internal server error occurred while fetching stats.' });
    }
});

// --- START SERVER ---
connectToDb().then(() => {
    app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
});