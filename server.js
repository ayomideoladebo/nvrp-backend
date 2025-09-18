const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const mysql = require('mysql2/promise');
const Rcon = require('samp-rcon');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CREDENTIALS ---
const DONATIONS_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1418014006836199526/OE4J0sWbDSxcePTAH0qgE8JKa5BDTS5Zj0YpjNcTu55dcA5oI3j7WVUM7zzbasF-GHK5";
const APPLICATIONS_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1418014141452386405/6zo3kwZ24-RakI_btJN8kiegGnuwkSvN5SPmBeQJ9j_Wv2IsE3mpZGLf4KgOY_h1Z2X3";
const ADMIN_LOG_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1418034132918861846/38JJ6MS0b1gXj4hbkfr9kkOgDrXxYuytjUv5HX8rYOlImK9CHpsj3JSsCglupTt9Pkgf";

const MONGODB_URI = "mongodb+srv://nigeria-vibe-rp:tZVQJoaro79jzoAr@nigeria-vibe-rp.ldx39qg.mongodb.net/?retryWrites=true&w=majority&appName=nigeria-vibe-rp";
const DB_NAME = "nigeria-vibe-rp";
let db;

let sampDbPool;
const sampDbOptions = {
    host: '217.182.175.212',
    user: 'u3225914_Ur9bu1nnxG',
    password: '5WNZTyZSQkbv@ix5kif^AhzF',
    database: 's3225914_9javiberp',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const rconOptions = {
    host: "217.182.175.212",
    port: 28071,
    password: "10903f2478b10a37"
};

// --- DATABASE & RCON CONNECTIONS ---
async function connectToMongo() {
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

async function connectToSampDb() {
    try {
        sampDbPool = mysql.createPool(sampDbOptions);
        await sampDbPool.query('SELECT 1');
        console.log("Successfully connected to SA-MP MySQL Database!");
    } catch (err) {
        console.error("Failed to connect to SA-MP MySQL Database", err);
        process.exit(1);
    }
}

// Helper function to send a single RCON command
async function sendRconCommand(command) {
    const rcon = new Rcon(rconOptions);
    try {
        await rcon.connect();
        await rcon.send(command);
        await rcon.disconnect();
        return { success: true };
    } catch (error) {
        console.error(`RCON command failed: ${command}`, error);
        return { success: false, error };
    }
}

// Helper function to translate faction ID to name
function getFactionName(factionId) {
    switch (factionId) {
        case 1: return "Police";
        case 2: return "Medic/Fire";
        case 4: return "Government";
        case 5: return "Mechanic";
        case 11: return "EFCC";
        default: return "Civilian";
    }
}

// Helper function to send Discord notifications
async function sendToDiscord(webhookUrl, embed) {
    if (!webhookUrl || webhookUrl.includes("YOUR_")) {
        console.log("Discord Webhook URL is not configured. Skipping notification.");
        return;
    }
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "NV:RP Alerter",
                avatar_url: "https://i.imgur.com/4M34hi2.png",
                embeds: [embed]
            })
        });
    } catch (error) {
        console.error("Error sending to Discord:", error.message);
    }
}

// --- CONFIGURATION & MIDDLEWARE ---
const ADMIN_USERNAME = "adminnvrp";
const ADMIN_PASSWORD = "password1234";
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage }).single('screenshot');


// --- API ROUTES ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.post('/api/donations', (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ message: err });
        if (!req.file) return res.status(400).json({ message: 'Error: No File Selected!' });
        const { tier, price, discordUser, inGameName } = req.body;
        const newDonation = { tier, price: `₦${parseInt(price).toLocaleString()}`, discordUser, inGameName, screenshotUrl: `/uploads/${req.file.filename}`, date: new Date(), status: 'pending' };
        await db.collection('donations').insertOne(newDonation);
        const donationEmbed = { title: "💰 New Donation Submitted!", color: 0xFFD700, fields: [{ name: "In-Game Name", value: inGameName, inline: true }, { name: "Discord User", value: discordUser, inline: true }, { name: "Tier", value: tier, inline: true }, { name: "Amount", value: `₦${parseInt(price).toLocaleString()}`, inline: true }], footer: { text: "Please verify the payment in the admin dashboard." }, timestamp: new Date().toISOString() };
        sendToDiscord(DONATIONS_WEBHOOK_URL, donationEmbed);
        res.status(201).json({ message: 'Donation submitted successfully!' });
    });
});

app.get('/api/donations', async (req, res) => {
    const donations = await db.collection('donations').find().sort({date: -1}).toArray();
    res.json(donations);
});

app.put('/api/donations/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid ID format.' });
    await db.collection('donations').updateOne({ _id: new ObjectId(id) }, { $set: { status: status } });
    res.json({ message: 'Status updated successfully' });
});

app.post('/api/waitlist', async (req, res) => {
    const { discordUser, inGameName, age } = req.body;
    const newApplication = { date: new Date(), ...req.body };
    await db.collection('waitlist').insertOne(newApplication);
    const applicationEmbed = { title: "📝 New Player Application!", color: 0x00BFFF, fields: [{ name: "In-Game Name", value: inGameName, inline: true }, { name: "Discord User", value: discordUser, inline: true }, { name: "Age", value: age, inline: true }], footer: { text: "Please review the full application in the dashboard." }, timestamp: new Date().toISOString() };
    sendToDiscord(APPLICATIONS_WEBHOOK_URL, applicationEmbed);
    res.status(201).json({ message: 'Application submitted successfully!' });
});

app.get('/api/waitlist', async (req, res) => {
    const waitlist = await db.collection('waitlist').find().sort({date: -1}).toArray();
    res.json(waitlist);
});

app.get('/api/dashboard-stats', async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalPlayers = await db.collection('waitlist').countDocuments();
    const playersToday = await db.collection('waitlist').countDocuments({ date: { $gte: today } });
    const totalDonations = await db.collection('donations').countDocuments();
    const pendingDonations = await db.collection('donations').countDocuments({ status: 'pending' });
    res.json({ totalPlayers, playersToday, totalDonations, pendingDonations });
});

app.get('/api/player/:name', async (req, res) => {
    const playerName = req.params.name;
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        const [playerRows, vehicleRows, propertyLogs] = await Promise.all([
            sampDbPool.query("SELECT `cash`, `bank`, `level`, `hours`, `faction`, `factionrank`, `fleeca_bank`, `crimes` FROM `users` WHERE `name` = ?", [playerName]),
            sampDbPool.query("SELECT `modelid`, `tickets` FROM `vehicles` WHERE `owner` = ?", [playerName]),
            sampDbPool.query("SELECT `description` FROM `log_property` WHERE `description` LIKE ?", [`%${playerName}%`])
        ]);
        const playerData = playerRows[0];
        if (!playerData || playerData.length === 0) {
            return res.status(404).json({ message: "Player not found in the game database." });
        }
        const finalPlayerData = playerData[0];
        finalPlayerData.factionName = getFactionName(finalPlayerData.faction);
        res.json({ stats: finalPlayerData, vehicles: vehicleRows[0], propertyLogs: propertyLogs[0] });
    } catch (error) {
        console.error("Error fetching player data from MySQL:", error);
        res.status(500).json({ message: "An error occurred while fetching player data." });
    }
});

app.get('/api/admin/online-players', async (req, res) => {
    const rcon = new Rcon(rconOptions);
    try {
        await rcon.connect();
        const players = await rcon.getPlayers();
        await rcon.disconnect();
        res.json(players);
    } catch (error) {
        console.error("RCON Get Players Error:", error);
        res.status(500).json({ message: "Failed to fetch online players." });
    }
});

app.post('/api/admin/command', async (req, res) => {
    const { playerName, command, value, reason } = req.body;
    if (!playerName || !command) {
        return res.status(400).json({ message: "Player name and command are required." });
    }
    let rconCommand = '';
    let successMessage = '';
    let logEmbed;
    const adminUser = "Web Dashboard";
    switch (command) {
        case 'kick':
            rconCommand = `kick ${playerName}`;
            successMessage = `${playerName} was kicked. Reason: ${reason || 'N/A'}`;
            logEmbed = { title: "🛡️ Player Kicked", color: 0xFFA500, fields: [{ name: "Player", value: playerName, inline: true }, { name: "Reason", value: reason || "Not specified", inline: true }, { name: "Executed By", value: adminUser, inline: true }] };
            break;
        case 'ban':
            rconCommand = `ban ${playerName}`;
            successMessage = `${playerName} was banned. Reason: ${reason || 'N/A'}`;
            logEmbed = { title: "🚫 Player Banned", color: 0xFF0000, fields: [{ name: "Player", value: playerName, inline: true }, { name: "Reason", value: reason || "Not specified", inline: true }, { name: "Executed By", value: adminUser, inline: true }] };
            break;
        case 'givemoney':
            if (!value || isNaN(parseInt(value))) return res.status(400).json({ message: "A valid amount is required." });
            rconCommand = `givemoney ${playerName} ${value}`;
            successMessage = `Gave $${parseInt(value).toLocaleString()} to ${playerName}.`;
            logEmbed = { title: "💸 Money Given", color: 0x00FF00, fields: [{ name: "Player", value: playerName, inline: true }, { name: "Amount", value: `$${parseInt(value).toLocaleString()}`, inline: true }, { name: "Executed By", value: adminUser, inline: true }] };
            break;
        case 'dealership':
            rconCommand = `sendtodealership ${playerName}`;
            successMessage = `Sent ${playerName} to the dealership.`;
            logEmbed = { title: "🚗 Sent to Dealership", color: 0xADD8E6, fields: [{ name: "Player", value: playerName, inline: true }, { name: "Executed By", value: adminUser, inline: true }] };
            break;
        default:
            return res.status(400).json({ message: "Invalid command." });
    }
    const result = await sendRconCommand(rconCommand);
    if (result.success) {
        await sendRconCommand(`say [WEB-ADMIN] ${successMessage}`);
        if (logEmbed) {
            logEmbed.timestamp = new Date().toISOString();
            sendToDiscord(ADMIN_LOG_WEBHOOK_URL, logEmbed);
        }
        res.json({ success: true, message: successMessage });
    } else {
        res.status(500).json({ message: `Failed to execute command on the server.` });
    }
});

// --- START SERVER ---
Promise.all([connectToMongo(), connectToSampDb()]).then(() => {
    app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
}).catch(err => {
    console.error("Failed to initialize databases and start server.", err);
});