const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const mysql = require('mysql2/promise');
const cron = require('node-cron');
const fetch = require('node-fetch'); // Use node-fetch for older Node.js versions

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION: REPLACE WITH YOUR OWN VALUES ---
const CONFIG = {
    ADMIN_USERNAME: "adminnvrp",
    ADMIN_PASSWORD: "password1234",
    MONGO_URI: "mongodb+srv://nigeria-vibe-rp:tZVQJoaro79jzoAr@nigeria-vibe-rp.ldx39qg.mongodb.net/?retryWrites=true&w=majority&appName=nigeria-vibe-rp",
    DB_NAME: "nigeria-vibe-rp",
    SAMP_DB_OPTIONS: {
        host: '217.182.175.212',
        user: 'u3225914_Ur9bu1nnxG',
        password: '5WNZTyZSQkbWix5kifAhzF',
        database: 's3225914_9javiberp',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    },
    WEBHOOKS: {
        DONATIONS: "https://discordapp.com/api/webhooks/1418014006836199526/OE4J0sWbDSxcePTAH0qgE8JKa5BDTS5Zj0YpjNcTu55dcA5oI3j7WVUM7zzbasF-GHK5",
        APPLICATIONS: "https://discordapp.com/api/webhooks/1418014141452386405/6zo3kwZ24-RakI_btJN8kiegGnuwkSvN5SPmBeQJ9j_Wv2IsE3mpZGLf4KgOY_h1Z2X3",
        ADMIN_LOG: "https://discordapp.com/api/webhooks/1418034132918861846/38JJ6MS0b1gXj4hbkfr9kkOgDrXxYuytjUv5HX8rYOlImK9CHpsj3JSsCglupTt9Pkgf",
        FACTION_LOG: "https://discord.com/api/webhooks/1418034132918861846/38JJ6MS0b1gXj4hbkfr9kkOgDrXxYuytjUv5HX8rYOlImK9CHpsj3JSsCglupTt9Pkgf",
        GANG_LOG: "https://discordapp.com/api/webhooks/1418402752211451944/XT6G-Q96LobSbmoubUJ3QBxux9E9F1f3oBklBQ28ztE06SYE4jXdvnLmvPMJKe6wfP1T",
        EVENT_ANNOUNCEMENT: "https://discordapp.com/api/webhooks/1418604487060226179/N1MoYe7h7wkwsIQjaQ9Nb6Vn4lYmTJ0a2QvJwh1CG3RyCGOVFOyBcPkiWWyhUCJ2YCvK"
    }
};

let db;
let sampDbPool;

// --- UTILITIES & MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage }).single('screenshot');

function getFactionName(factionId) {
    const names = { 1: "Police", 2: "Medic/Fire", 4: "Government", 5: "Mechanic", 11: "EFCC" };
    return names[factionId] || "Civilian";
}

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

// --- DATABASE CONNECTIONS ---
async function connectToMongo() {
    try {
        const client = new MongoClient(CONFIG.MONGO_URI);
        await client.connect();
        db = client.db(CONFIG.DB_NAME);
        console.log("Successfully connected to MongoDB Atlas!");
    } catch (err) {
        console.error("Failed to connect to MongoDB", err);
        throw err;
    }
}

async function connectToSampDb() {
    try {
        sampDbPool = mysql.createPool(CONFIG.SAMP_DB_OPTIONS);
        await sampDbPool.query('SELECT 1');
        console.log("Successfully connected to SA-MP MySQL Database!");
    } catch (err) {
        console.error("Failed to connect to SA-MP MySQL Database", err);
        throw err;
    }
}

// --- API ROUTES ---

// Admin & Auth
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === CONFIG.ADMIN_USERNAME && password === CONFIG.ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Donation Routes
app.post('/api/donations', (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ message: err });
        if (!req.file) return res.status(400).json({ message: 'Error: No File Selected!' });
        const { tier, price, discordUser, inGameName } = req.body;
        const newDonation = { tier, price: `₦${parseInt(price).toLocaleString()}`, discordUser, inGameName, screenshotUrl: `/uploads/${req.file.filename}`, date: new Date(), status: 'pending' };
        await db.collection('donations').insertOne(newDonation);
        const donationEmbed = { title: "💰 New Donation Submitted!", color: 0xFFD700, fields: [{ name: "In-Game Name", value: inGameName, inline: true }, { name: "Discord User", value: discordUser, inline: true }, { name: "Tier", value: tier, inline: true }, { name: "Amount", value: `₦${parseInt(price).toLocaleString()}`, inline: true }], footer: { text: "Please verify the payment in the admin dashboard." }, timestamp: new Date().toISOString() };
        sendToDiscord(CONFIG.WEBHOOKS.DONATIONS, donationEmbed);
        res.status(201).json({ message: 'Donation submitted successfully!' });
    });
});

app.get('/api/donations', async (req, res) => {
    try {
        const donations = await db.collection('donations').find().sort({date: -1}).toArray();
        res.json(donations);
    } catch (error) { res.status(500).json({ message: "Failed to fetch donations." }); }
});

app.put('/api/donations/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid ID format.' });
    try {
        await db.collection('donations').updateOne({ _id: new ObjectId(id) }, { $set: { status: status } });
        res.json({ message: 'Status updated successfully' });
    } catch (error) { res.status(500).json({ message: "Failed to update status." }); }
});

// Application & Dashboard Stats
app.post('/api/waitlist', async (req, res) => {
    const { discordUser, inGameName, age } = req.body;
    const newApplication = { date: new Date(), ...req.body };
    await db.collection('waitlist').insertOne(newApplication);
    const applicationEmbed = { title: "📝 New Player Application!", color: 0x00BFFF, fields: [{ name: "In-Game Name", value: inGameName, inline: true }, { name: "Discord User", value: discordUser, inline: true }, { name: "Age", value: age, inline: true }], footer: { text: "Please review the full application in the dashboard." }, timestamp: new Date().toISOString() };
    sendToDiscord(CONFIG.WEBHOOKS.APPLICATIONS, applicationEmbed);
    res.status(201).json({ message: 'Application submitted successfully!' });
});

app.get('/api/waitlist', async (req, res) => {
    try {
        const waitlist = await db.collection('waitlist').find().sort({date: -1}).toArray();
        res.json(waitlist);
    } catch (error) { res.status(500).json({ message: "Failed to fetch waitlist." }); }
});

app.get('/api/dashboard-stats', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const totalPlayers = await db.collection('waitlist').countDocuments();
        const playersToday = await db.collection('waitlist').countDocuments({ date: { $gte: today } });
        const totalDonations = await db.collection('donations').countDocuments();
        const pendingDonations = await db.collection('donations').countDocuments({ status: 'pending' });
        res.json({ totalPlayers, playersToday, totalDonations, pendingDonations });
    } catch (error) { res.status(500).json({ message: "Failed to fetch stats." }); }
});

// Player & Game Data
app.get('/api/player/:name', async (req, res) => {
    const playerName = req.params.name;
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        const [playerRows] = await sampDbPool.query("SELECT `cash`, `bank`, `level`, `hours`, `faction`, `factionrank`, `fleeca_bank`, `crimes` FROM `users` WHERE `username` = ?", [playerName]);
        if (playerRows.length === 0) {
            return res.status(404).json({ message: "Player not found in the game database." });
        }
        const [vehicleRows] = await sampDbPool.query("SELECT `modelid`, `tickets` FROM `vehicles` WHERE `owner` = ?", [playerName]);
        const [propertyLogs] = await sampDbPool.query("SELECT `description` FROM `log_property` WHERE `description` LIKE ?", [`%${playerName}%`]);

        const finalPlayerData = playerRows[0];
        finalPlayerData.factionName = getFactionName(finalPlayerData.faction);
        res.json({ stats: finalPlayerData, vehicles: vehicleRows, propertyLogs: propertyLogs });
    } catch (error) {
        console.error("Error fetching player data from MySQL:", error);
        res.status(500).json({ message: "An error occurred while fetching player data." });
    }
});

app.get('/api/online-players', async (req, res) => {
    if (!sampDbPool) { return res.status(503).json({ message: "Game database is not connected." }); }
    try {
        const [rows] = await sampDbPool.query("SELECT `username` FROM `users` WHERE `is_online` = 1");
        res.json(rows);
    } catch (error) {
        console.error("MySQL Get Online Players Error:", error);
        res.status(500).json({ message: "Failed to fetch online players." });
    }
});

app.get('/api/logs/:type', async (req, res) => {
    const validTypes = { admin: 'log_admin', faction: 'log_faction', gang: 'log_gang' };
    const tableName = validTypes[req.params.type];
    if (!tableName) return res.status(400).json({ message: 'Invalid log type.' });
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;
    try {
        const [logs] = await sampDbPool.query(`SELECT date, description FROM \`${tableName}\` ORDER BY date DESC LIMIT ? OFFSET ?`, [limit, offset]);
        const [[{ count }]] = await sampDbPool.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
        res.json({ logs, totalCount: count, totalPages: Math.ceil(count / limit), currentPage: page });
    } catch (error) {
        console.error(`MySQL Get Logs Error:`, error);
        res.status(500).json({ message: `Failed to fetch logs.` });
    }
});

app.get('/api/economy-stats', async (req, res) => {
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        const [totalPlayerWealthRows] = await sampDbPool.query("SELECT SUM(cash) AS totalPlayerCash, SUM(bank) AS totalPlayerBank FROM users");
        const [wealthDistributionRows] = await sampDbPool.query(`SELECT CASE WHEN (cash + bank) BETWEEN 0 AND 25000 THEN 'Newcomer ($0 - $25k)' WHEN (cash + bank) BETWEEN 25001 AND 150000 THEN 'Working Class ($25k - $150k)' WHEN (cash + bank) BETWEEN 150001 AND 750000 THEN 'Middle Class ($150k - $750k)' ELSE 'Wealthy ($750k+)' END AS wealthBracket, COUNT(*) AS playerCount FROM users GROUP BY wealthBracket ORDER BY MIN(cash + bank)`);
        const [topVehiclesRows] = await sampDbPool.query("SELECT modelid, COUNT(*) AS vehicleCount FROM vehicles GROUP BY modelid ORDER BY vehicleCount DESC LIMIT 10");
        const [[ownedBusinessesCount]] = await sampDbPool.query("SELECT COUNT(*) as ownedBusinesses FROM businesses WHERE ownerid != 0");
        const [[totalBusinessesCount]] = await sampDbPool.query("SELECT COUNT(*) as totalBusinesses FROM businesses");
        const [[totalBusinessCashSum]] = await sampDbPool.query("SELECT SUM(cash) as totalBusinessCash FROM businesses");
        const [wealthiestPlayers] = await sampDbPool.query("SELECT username, (cash + bank) as total_wealth FROM users ORDER BY total_wealth DESC LIMIT 10");
        const [topBusinesses] = await sampDbPool.query("SELECT biz_desc, cash FROM businesses WHERE ownerid != 0 ORDER BY cash DESC LIMIT 10");
        const [factionTreasuries] = await sampDbPool.query("SELECT name, faction_treasury FROM factions ORDER BY faction_treasury DESC");
        const [[yesterdayData]] = await sampDbPool.query("SELECT total_circulation FROM economy_snapshots WHERE snapshot_date = CURDATE() - INTERVAL 1 DAY");
        const [[weekAgoData]] = await sampDbPool.query("SELECT total_circulation FROM economy_snapshots WHERE snapshot_date = CURDATE() - INTERVAL 7 DAY");
        const [historyData] = await sampDbPool.query("SELECT snapshot_date, total_circulation FROM economy_snapshots ORDER BY snapshot_date DESC LIMIT 30");
        const [[govData]] = await sampDbPool.query("SELECT gov_treasury FROM settings LIMIT 1");

        const playerWealth = totalPlayerWealthRows[0] || { totalPlayerCash: 0, totalPlayerBank: 0 };
        const cashNum = parseInt(playerWealth.totalPlayerCash) || 0;
        const bankNum = parseInt(playerWealth.totalPlayerBank) || 0;

        res.json({
            totalCirculation: cashNum + bankNum,
            totalPlayerCash: cashNum,
            totalPlayerBank: bankNum,
            wealthDistribution: wealthDistributionRows,
            topVehicles: topVehiclesRows,
            ownedBusinesses: ownedBusinessesCount.ownedBusinesses || 0,
            totalBusinesses: totalBusinessesCount.totalBusinesses || 0,
            totalBusinessCash: totalBusinessCashSum.totalBusinessCash || 0,
            wealthiestPlayers, topBusinesses, factionTreasuries,
            yesterdayCirculation: parseInt(yesterdayData?.total_circulation) || 0,
            weekAgoCirculation: parseInt(weekAgoData?.total_circulation) || 0,
            circulationHistory: historyData,
            governmentTreasury: parseInt(govData?.gov_treasury) || 0
        });
    } catch (error) {
        console.error("MySQL Get Economy Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch economy statistics." });
    }
});

// Event Manager Routes
app.get('/api/events', async (req, res) => {
    try {
        const events = await db.collection('events').find().sort({ event_time: 1 }).toArray();
        res.json(events);
    } catch (error) { res.status(500).json({ message: "Failed to fetch events." }); }
});

app.post('/api/events', async (req, res) => {
    const { title, description, event_time, announcement_time } = req.body;
    try {
        const newEvent = {
            title,
            description,
            event_time: new Date(event_time),
            announcement_time: announcement_time ? new Date(announcement_time) : null,
            is_announced: false,
            created_at: new Date()
        };
        await db.collection('events').insertOne(newEvent);
        res.status(201).json({ message: 'Event created successfully!' });
    } catch (error) { res.status(500).json({ message: "Failed to create event." }); }
});

app.delete('/api/events/:id', async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid ID format.' });
    try {
        await db.collection('events').deleteOne({ _id: new ObjectId(id) });
        res.json({ message: 'Event deleted successfully' });
    } catch (error) { res.status(500).json({ message: "Failed to delete event." }); }
});

app.get('/api/event-logs', async (req, res) => {
    try {
        const logs = await db.collection('event_logs').find().sort({ log_date: -1 }).limit(15).toArray();
        res.json(logs);
    } catch (error) { res.status(500).json({ message: "Failed to fetch event logs." }); }
});

app.post('/api/event-logs', async (req, res) => {
    const { summary } = req.body;
    try {
        const newLog = {
            summary,
            log_date: new Date()
        };
        await db.collection('event_logs').insertOne(newLog);
        res.status(201).json({ message: 'Event log saved successfully!' });
    } catch (error) { res.status(500).json({ message: "Failed to save event log." }); }
});

app.post('/api/pay-winner', async (req, res) => {
    const { playerName, amount, reason, adminName } = req.body;
    const paymentAmount = parseInt(amount);
    if (!playerName || !paymentAmount || !reason || paymentAmount <= 0) {
        return res.status(400).json({ message: 'Invalid data provided.' });
    }
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        const [playerRows] = await sampDbPool.query("SELECT `bank` FROM `users` WHERE `username` = ?", [playerName]);
        if (playerRows.length === 0) {
            return res.status(404).json({ message: 'Player not found.' });
        }
        await sampDbPool.query("UPDATE `users` SET `bank` = `bank` + ? WHERE `username` = ?", [paymentAmount, playerName]);
        const logDescription = `Admin ${adminName || 'Unknown'} paid ${playerName} $${paymentAmount.toLocaleString()} for: ${reason}`;
        await sampDbPool.query("INSERT INTO `log_admin` (date, description) VALUES (NOW(), ?)", [logDescription]);
        res.json({ message: `Successfully paid ${playerName} $${paymentAmount.toLocaleString()}` });
    } catch (error) {
        console.error("Error in pay-winner:", error);
        res.status(500).json({ message: "Failed to pay winner." });
    }
});

app.get('/api/raffle-winner', async (req, res) => {
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        const [rows] = await sampDbPool.query("SELECT username FROM users ORDER BY RAND() LIMIT 1");
        if (rows.length === 0) {
            return res.status(404).json({ message: 'No players found in the database.' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error("Raffle winner error:", error);
        res.status(500).json({ message: 'Failed to draw a winner.' });
    }
});

app.post('/api/quick-announce', async (req, res) => {
    const { message, adminName } = req.body;
    if (!message) {
        return res.status(400).json({ message: 'Message cannot be empty.' });
    }
    const embed = {
        title: "📢 Event Announcement",
        description: message,
        color: 0x5865F2,
        footer: { text: `Posted by ${adminName || 'Event Manager'}` },
        timestamp: new Date().toISOString()
    };
    await sendToDiscord(CONFIG.WEBHOOKS.EVENT_ANNOUNCEMENT, embed);
    res.json({ message: 'Announcement sent to Discord!' });
});

// --- SERVER & CRON JOBS ---
Promise.all([connectToMongo(), connectToSampDb()])
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server started on port ${PORT}`);

            // Daily Economy Snapshot
            cron.schedule('59 23 * * *', async () => {
                console.log(`[${new Date().toLocaleString()}] Running daily economy snapshot job...`);
                if (!sampDbPool) return console.log('Database not connected, skipping snapshot.');
                try {
                    const [[{ total }]] = await sampDbPool.query("SELECT SUM(cash + bank) as total FROM users");
                    const totalCirculation = parseInt(total) || 0;
                    await sampDbPool.query("INSERT INTO economy_snapshots (snapshot_date, total_circulation) VALUES (CURDATE(), ?) ON DUPLICATE KEY UPDATE total_circulation = ?", [totalCirculation, totalCirculation]);
                    console.log(`Successfully saved economy snapshot: $${totalCirculation.toLocaleString()}`);
                } catch (err) { console.error("Error running economy snapshot job:", err); }
            });

            // Event Announcements
            cron.schedule('* * * * *', async () => {
                try {
                    const now = new Date();
                    const eventsToAnnounce = await db.collection('events').find({
                        announcement_time: { $lte: now },
                        is_announced: false
                    }).toArray();
                    for (const event of eventsToAnnounce) {
                        const embed = {
                            title: `🎉 Upcoming Event: ${event.title}`,
                            description: event.description,
                            color: 0xFFD700,
                            fields: [{ name: "Event Time", value: `<t:${Math.floor(event.event_time.getTime() / 1000)}:F>`, inline: true }],
                            footer: { text: "Get ready!" }
                        };
                        await sendToDiscord(CONFIG.WEBHOOKS.EVENT_ANNOUNCEMENT, embed);
                        await db.collection('events').updateOne({ _id: event._id }, { $set: { is_announced: true } });
                    }
                } catch (err) { console.error("Error in scheduled announcement job:", err); }
            });
        });
    })
    .catch(err => {
        console.error("Failed to initialize databases and start server.", err);
    });