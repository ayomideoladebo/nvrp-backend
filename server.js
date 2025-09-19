const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const mysql = require('mysql2/promise');
const cron = require('node-cron'); // ADDED FOR SCHEDULING

const app = express();
const PORT = process.env.PORT || 3000;

// --- CREDENTIALS ---
const DONATIONS_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1418014006836199526/OE4J0sWbDSxcePTAH0qgE8JKa5BDTS5Zj0YpjNcTu55dcA5oI3j7WVUM7zzbasF-GHK5";
const APPLICATIONS_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1418014141452386405/6zo3kwZ24-RakI_btJN8kiegGnuwkSvN5SPmBeQJ9j_Wv2IsE3mpZGLf4KgOY_h1Z2X3";
const ADMIN_LOG_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1418034132918861846/38JJ6MS0b1gXj4hbkfr9kkOgDrXxYuytjUv5HX8rYOlImK9CHpsj3JSsCglupTt9Pkgf";
const FACTION_LOG_WEBHOOK_URL = "https://discord.com/api/webhooks/1418034132918861846/38JJ6MS0b1gXj4hbkfr9kkOgDrXxYuytjUv5HX8rYOlImK9CHpsj3JSsCglupTt9Pkgf";
const GANG_LOG_WEBHOOK_URL = "YOUR_GANG_LOG_WEBHOOK_URL_HERE";
const EVENTS_WEBHOOK_URL = "YOUR_EVENTS_WEBHOOK_URL_HERE"; // <<<--- ADD THIS LINE AND YOUR WEBHOOK URL

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

// --- DATABASE CONNECTIONS ---
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

// --- HELPER FUNCTIONS ---
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
            sampDbPool.query("SELECT `cash`, `bank`, `level`, `hours`, `faction`, `factionrank`, `fleeca_bank`, `crimes` FROM `users` WHERE `username` = ?", [playerName]),
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

app.get('/api/online-players', async (req, res) => {
    if (!sampDbPool) {
        return res.status(503).json({ message: "Game database is not connected." });
    }
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
    const logType = req.params.type;
    const tableName = validTypes[logType];
    if (!tableName) { return res.status(400).json({ message: 'Invalid log type requested.' }); }
    if (!sampDbPool) { return res.status(503).json({ message: "Game database is not connected." }); }
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;
    try {
        const [logs] = await sampDbPool.query(`SELECT date, description FROM \`${tableName}\` ORDER BY date DESC LIMIT ? OFFSET ?`, [limit, offset]);
        const [[{ count }]] = await sampDbPool.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
        res.json({ logs, totalCount: count, totalPages: Math.ceil(count / limit), currentPage: page });
    } catch (error) {
        console.error(`MySQL Get ${logType} Logs Error:`, error);
        res.status(500).json({ message: `Failed to fetch ${logType} logs.` });
    }
});

// --- ECONOMY ENDPOINT (UPDATED FOR HISTORY & LEADERBOARDS) ---
app.get('/api/economy-stats', async (req, res) => {
    if (!sampDbPool) { return res.status(503).json({ message: "Game database is not connected." }); }
    try {
        const queries = [
            sampDbPool.query("SELECT SUM(cash) AS totalPlayerCash, SUM(bank) AS totalPlayerBank FROM users"),
            sampDbPool.query(`SELECT CASE WHEN (cash + bank) BETWEEN 0 AND 25000 THEN 'Newcomer (₦0 - ₦25k)' WHEN (cash + bank) BETWEEN 25001 AND 150000 THEN 'Working Class (₦25k - ₦150k)' WHEN (cash + bank) BETWEEN 150001 AND 750000 THEN 'Middle Class (₦150k - ₦750k)' ELSE 'Wealthy (₦750k+)' END AS wealthBracket, COUNT(*) AS playerCount FROM users GROUP BY wealthBracket ORDER BY MIN(cash + bank)`),
            sampDbPool.query("SELECT modelid, COUNT(*) AS vehicleCount FROM vehicles GROUP BY modelid ORDER BY vehicleCount DESC LIMIT 10"),
            sampDbPool.query("SELECT COUNT(*) as ownedBusinesses FROM businesses WHERE ownerid != 0"),
            sampDbPool.query("SELECT COUNT(*) as totalBusinesses FROM businesses"),
            sampDbPool.query("SELECT SUM(cash) as totalBusinessCash FROM businesses"),
            sampDbPool.query("SELECT username, (cash + bank) as total_wealth FROM users ORDER BY total_wealth DESC LIMIT 10"),
            sampDbPool.query("SELECT biz_desc, cash FROM businesses WHERE ownerid != 0 ORDER BY cash DESC LIMIT 10"),
            sampDbPool.query("SELECT name, faction_treasury FROM factions ORDER BY faction_treasury DESC"),
            sampDbPool.query("SELECT total_circulation FROM economy_snapshots WHERE snapshot_date = CURDATE() - INTERVAL 1 DAY"),
            sampDbPool.query("SELECT total_circulation FROM economy_snapshots WHERE snapshot_date = CURDATE() - INTERVAL 7 DAY"),
            sampDbPool.query("SELECT snapshot_date, total_circulation FROM economy_snapshots ORDER BY snapshot_date DESC LIMIT 30"),
            sampDbPool.query("SELECT gov_treasury FROM settings")
        ];

        const results = await Promise.all(queries.map(p => p.catch(e => [[]]))); // Safer Promise handling

        const playerWealth = results[0][0][0] || { totalPlayerCash: 0, totalPlayerBank: 0 };
        const wealthDistribution = results[1][0] || [];
        const topVehicles = results[2][0] || [];
        const ownedBusinessesCount = results[3][0][0] || { ownedBusinesses: 0 };
        const totalBusinessesCount = results[4][0][0] || { totalBusinesses: 0 };
        const totalBusinessCashSum = results[5][0][0] || { totalBusinessCash: 0 };
        const wealthiestPlayers = results[6][0] || [];
        const topBusinesses = results[7][0] || [];
        const factionTreasuries = results[8][0] || [];
        const yesterdayData = results[9][0][0] || { total_circulation: 0 };
        const weekAgoData = results[10][0][0] || { total_circulation: 0 };
        const historyData = results[11][0] || [];
        const governmentTreasury = results[12][0][0] || { gov_treasury: 0 };
        
        const cashNum = parseInt(playerWealth.totalPlayerCash) || 0;
        const bankNum = parseInt(playerWealth.totalPlayerBank) || 0;

        res.json({
            totalCirculation: cashNum + bankNum,
            totalPlayerCash: cashNum,
            totalPlayerBank: bankNum,
            wealthDistribution, topVehicles,
            ownedBusinesses: ownedBusinessesCount.ownedBusinesses,
            totalBusinesses: totalBusinessesCount.totalBusinesses,
            totalBusinessCash: totalBusinessCashSum.totalBusinessCash || 0,
            wealthiestPlayers, topBusinesses, factionTreasuries,
            yesterdayCirculation: parseInt(yesterdayData.total_circulation) || 0,
            weekAgoCirculation: parseInt(weekAgoData.total_circulation) || 0,
            circulationHistory: historyData,
            governmentTreasury: governmentTreasury.gov_treasury
        });

    } catch (error) {
        console.error("MySQL Get Economy Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch economy statistics." });
    }
});

app.get('/api/events', async (req, res) => {
    if (!sampDbPool) { return res.status(503).json({ message: "Game database is not connected." }); }
    try {
        const [rows] = await sampDbPool.query("SELECT * FROM `events` ORDER BY `event_date` ASC");
        res.json(rows);
    } catch (error) {
        console.error("MySQL Get Events Error:", error);
        res.status(500).json({ message: "Failed to fetch events." });
    }
});

app.post('/api/events', async (req, res) => {
    if (!sampDbPool) { return res.status(503).json({ message: "Game database is not connected." }); }
    const { title, description, event_date, announcement_date } = req.body;
    try {
        await sampDbPool.query("INSERT INTO `events` (`title`, `description`, `event_date`, `announcement_date`) VALUES (?, ?, ?, ?)", [title, description, event_date, announcement_date]);
        res.status(201).json({ message: 'Event created successfully!' });
    } catch (error) {
        console.error("MySQL Create Event Error:", error);
        res.status(500).json({ message: "Failed to create event." });
    }
});

app.delete('/api/events/:id', async (req, res) => {
    if (!sampDbPool) { return res.status(503).json({ message: "Game database is not connected." }); }
    const { id } = req.params;
    try {
        await sampDbPool.query("DELETE FROM `events` WHERE `id` = ?", [id]);
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error("MySQL Delete Event Error:", error);
        res.status(500).json({ message: "Failed to delete event." });
    }
});

app.post('/api/pay-winner', async (req, res) => {
    const { playerName, amount, reason } = req.body;
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        await sampDbPool.query("UPDATE `users` SET `bank` = `bank` + ? WHERE `username` = ?", [amount, playerName]);
        await sampDbPool.query("INSERT INTO `log_admin` (`date`, `description`) VALUES (NOW(), ?)", [`Paid ${playerName} $${amount} for ${reason}`]);
        res.json({ message: 'Payment successful!' });
    } catch (error) {
        console.error("MySQL Pay Winner Error:", error);
        res.status(500).json({ message: "Failed to pay winner." });
    }
});

app.get('/api/event-logs', async (req, res) => {
    if (!sampDbPool) { return res.status(503).json({ message: "Game database is not connected." }); }
    try {
        const [rows] = await sampDbPool.query("SELECT * FROM `event_logs` ORDER BY `date` DESC LIMIT 15");
        res.json(rows);
    } catch (error) {
        console.error("MySQL Get Event Logs Error:", error);
        res.status(500).json({ message: "Failed to fetch event logs." });
    }
});

app.post('/api/event-log', async (req, res) => {
    if (!sampDbPool) { return res.status(503).json({ message: "Game database is not connected." }); }
    const { summary } = req.body;
    try {
        await sampDbPool.query("INSERT INTO `event_logs` (`summary`, `date`) VALUES (?, NOW())", [summary]);
        res.status(201).json({ message: 'Event log saved successfully!' });
    } catch (error) {
        console.error("MySQL Create Event Log Error:", error);
        res.status(500).json({ message: "Failed to save event log." });
    }
});

app.get('/api/random-player', async (req, res) => {
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        const [rows] = await sampDbPool.query("SELECT `username` FROM `users` ORDER BY RAND() LIMIT 1");
        res.json(rows[0]);
    } catch (error) {
        console.error("MySQL Get Random Player Error:", error);
        res.status(500).json({ message: "Failed to fetch random player." });
    }
});

// --- SERVER AND CRON JOB START ---
Promise.all([connectToMongo(), connectToSampDb()]).then(() => {
    app.listen(PORT, () => {
        console.log(`Server started on port ${PORT}`);

        // --- SCHEDULED DAILY ECONOMY SNAPSHOT ---
        console.log("Economy snapshot job scheduled for 23:59 daily.");
        cron.schedule('59 23 * * *', async () => {
            console.log(`[${new Date().toLocaleString()}] Running daily economy snapshot job...`);
            try {
                if (!sampDbPool) { console.log('Database not connected, skipping snapshot.'); return; }
                
                const [[{ total }]] = await sampDbPool.query("SELECT SUM(cash + bank) as total FROM users");
                const totalCirculation = parseInt(total) || 0;

                await sampDbPool.query(
                    "INSERT INTO economy_snapshots (snapshot_date, total_circulation) VALUES (CURDATE(), ?) ON DUPLICATE KEY UPDATE total_circulation = ?",
                    [totalCirculation, totalCirculation]
                );
                console.log(`Successfully saved economy snapshot: $${totalCirculation.toLocaleString()}`);

            } catch (err) {
                console.error("Error running economy snapshot job:", err);
            }
        });
        
        // --- SCHEDULED DISCORD ANNOUNCEMENTS ---
        console.log("Discord announcement job scheduled to run every minute.");
        cron.schedule('* * * * *', async () => {
            if (!sampDbPool) { return; }
            const [events] = await sampDbPool.query("SELECT * FROM `events` WHERE `sent` = 0");
            for (const event of events) {
                if (new Date(event.announcement_date) <= new Date()) {
                    const eventEmbed = {
                        title: `Upcoming Event: ${event.title}`,
                        description: event.description,
                        color: 0x00FF00,
                        footer: { text: `Event Date: ${new Date(event.event_date).toLocaleString()}` }
                    };
                    sendToDiscord(EVENTS_WEBHOOK_URL, eventEmbed);
                    await sampDbPool.query("UPDATE `events` SET `sent` = 1 WHERE `id` = ?", [event.id]);
                }
            }
        });

    });
}).catch(err => {
    console.error("Failed to initialize databases and start server.", err);
});