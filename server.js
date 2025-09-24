const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const mysql = require('mysql2/promise');
const cron = require('node-cron');
const factionRoutes = require('./faction-routes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CREDENTIALS & CONFIGURATION ---
const DONATIONS_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1418014006836199526/OE4J0sWbDSxcePTAH0qgE8JKa5BDTS5Zj0YpjNcTu55dcA5oI3j7WVUM7zzbasF-GHK5";
const APPLICATIONS_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1418014141452386405/6zo3kwZ24-RakI_btJN8kiegGnuwkSvN5SPmBeQJ9j_Wv2IsE3mpZGLf4KgOY_h1Z2X3";
const ADMIN_LOG_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1418034132918861846/38JJ6MS0b1gXj4hbkfr9kkOgDrXxYuytjUv5HX8rYOlImK9CHpsj3JSsCglupTt9Pkgf";
const FACTION_LOG_WEBHOOK_URL = "https://discord.com/api/webhooks/1418034132918861846/38JJ6MS0b1gXj4hbkfr9kkOgDrXxYuytjUv5HX8rYOlImK9CHpsj3JSsCglupTt9Pkgf";
const GANG_LOG_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1418402752211451944/XT6G-Q96LobSbmoubUJ3QBxux9E9F1f3oBklBQ28ztE06SYE4jXdvnLmvPMJKe6wfP1T";
const EVENTS_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1418604487060226179/N1MoYe7h7wkwsIQjaQ9Nb6Vn4lYmTJ0a2QvJwh1CG3RyCGOVFOyBcPkiWWyhUCJ2YCvK";

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

const ADMIN_USERNAME = "adminnvrp";
const ADMIN_PASSWORD = "password1234";

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

function getFactionName(factionId) {
    switch (factionId) {
        case 1: return "Police";
        case 2: return "Medic/Fire";
        case 4: return "Government";
        case 5: return "Mechanic";
        case 16: return "EFCC";
        default: return "Civilian";
    }
}

async function sendToDiscord(webhookUrl, embed) {
    if (!webhookUrl || webhookUrl.includes("YOUR_")) {
        console.log("Discord Webhook URL is not configured. Skipping notification.");
        return;
    }
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "NV:RP Alerter",
                avatar_url: "https://i.imgur.com/4M34hi2.png",
                embeds: [embed]
            })
        });
        if(!response.ok) {
            console.error("Discord API error:", response.status, await response.text());
        }
    } catch (error) {
        console.error("Error sending to Discord:", error.message);
    }
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage }).single('screenshot');

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

app.post('/api/player/:name/teleport', async (req, res) => {
    const playerName = req.params.name;
    const { x, y, z } = { x: 546.7000, y: -1281.5160, z: 17.2482 }; // Hardcoded coordinates

    if (!sampDbPool) {
        return res.status(503).json({ message: "Game database is not connected." });
    }

    try {
        await sampDbPool.query(
            "UPDATE `users` SET `pos_x` = ?, `pos_y` = ?, `pos_z` = ? WHERE `username` = ?",
            [x, y, z, playerName]
        );
        res.json({ message: 'Player teleported successfully!' });
    } catch (error) {
        console.error("MySQL Teleport Player Error:", error);
        res.status(500).json({ message: "Failed to teleport player." });
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

app.get('/api/all-players', async (req, res) => {
    if (!sampDbPool) {
        return res.status(503).json({ message: "Game database is not connected." });
    }
    try {
        const [rows] = await sampDbPool.query("SELECT `username` FROM `users`");
        res.json(rows.map(r => r.username));
    } catch (error) {
        console.error("MySQL Get All Players Error:", error);
        res.status(500).json({ message: "Failed to fetch all players." });
    }
});

app.get('/api/player-locations', async (req, res) => {
    if (!sampDbPool) {
        return res.status(503).json({ message: "Game database is not connected." });
    }
    try {
        const [rows] = await sampDbPool.query("SELECT `username`, `pos_x`, `pos_y`, `is_online`, `faction` FROM `users`");
        res.json(rows);
    } catch (error) {
        console.error("MySQL Get Player Locations Error:", error);
        res.status(500).json({ message: "Failed to fetch player locations." });
    }
});

// Add this new endpoint to your server.js
// This will work alongside your existing /api/player-locations

app.get('/api/properties', async (req, res) => {
    // Make sure to use your game database connection pool
    if (!sampDbPool) {
        return res.status(503).json({ message: "Game database is not connected." });
    }
    try {
        // Query 1: Get all houses
        const [houses] = await sampDbPool.query(
            "SELECT id, owner, price, ownerid, pos_x, pos_y, pos_z FROM houses"
        );

        // Query 2: Get all businesses
        const [businesses] = await sampDbPool.query(
            "SELECT id, owner, type, price, ownerid, name, pos_x, pos_y, pos_z, cash FROM businesses"
        );

        // Combine into a single response object
        res.json({
            houses: houses.map(h => ({ ...h, is_owned: h.ownerid !== 0 })),
            businesses: businesses.map(b => ({ ...b, is_owned: b.ownerid !== 0 }))
        });

    } catch (error) {
        console.error("MySQL Get Properties Error:", error);
        res.status(500).json({ message: "Failed to fetch properties." });
    }
});

// Add this new endpoint to your server.js for the route replay feature

app.get('/api/player-route/:username', async (req, res) => {
    if (!sampDbPool) {
        return res.status(503).json({ message: "Game database is not connected." });
    }
    try {
        const username = req.params.username;

        // First, we need to get the player's SQL ID from their username
        const [users] = await sampDbPool.query("SELECT `uid` FROM `users` WHERE `username` = ?", [username]);

        if (users.length === 0) {
            return res.status(404).json({ message: "Player not found." });
        }
        const playerId = users[0].uid;

        // Now, get all locations for that player_id from the last 2 hours, in order
        const [route] = await sampDbPool.query(
            "SELECT pos_x, pos_y FROM player_locations WHERE player_id = ? AND timestamp > NOW() - INTERVAL 2 HOUR ORDER BY timestamp ASC",
            [playerId]
        );

        res.json(route);

    } catch (error) {
        console.error("MySQL Get Player Route Error:", error);
        res.status(500).json({ message: "Failed to fetch player route." });
    }
});

app.get('/api/all-players-list', async (req, res) => {
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        const [rows] = await sampDbPool.query("SELECT `username`, `level`, `hours`, `faction`, `ip` FROM `users` ORDER BY `username` ASC");
        res.json(rows);
    } catch (error) {
        console.error("MySQL Get All Players List Error:", error);
        res.status(500).json({ message: "Failed to fetch all players." });
    }
});

app.get('/api/duplicate-ips', async (req, res) => {
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        const [rows] = await sampDbPool.query("SELECT `ip`, COUNT(*) as `count` FROM `users` GROUP BY `ip` HAVING `count` > 1");
        res.json(rows.map(r => r.ip));
    } catch (error) {
        console.error("MySQL Get Duplicate IPs Error:", error);
        res.status(500).json({ message: "Failed to fetch duplicate IPs." });
    }
});


app.post('/api/player/:name/add-money', async (req, res) => {
    const playerName = req.params.name;
    const { amount } = req.body;
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        await sampDbPool.query("UPDATE `users` SET `bank` = `bank` + ? WHERE `username` = ?", [amount, playerName]);
        await sampDbPool.query("INSERT INTO `log_admin` (`date`, `description`) VALUES (NOW(), ?)", [`[ADMIN] Added $${parseInt(amount).toLocaleString()} to ${playerName}`]);
        res.json({ message: 'Money added successfully!' });
    } catch (error) {
        console.error("MySQL Add Money Error:", error);
        res.status(500).json({ message: "Failed to add money." });
    }
});

app.post('/api/player/:name/deduct-money', async (req, res) => {
    const playerName = req.params.name;
    const { amount } = req.body;
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        await sampDbPool.query("UPDATE `users` SET `bank` = `bank` - ? WHERE `username` = ?", [amount, playerName]);
        await sampDbPool.query("INSERT INTO `log_admin` (`date`, `description`) VALUES (NOW(), ?)", [`[ADMIN] Deducted $${parseInt(amount).toLocaleString()} from ${playerName}`]);
        res.json({ message: 'Money deducted successfully!' });
    } catch (error) {
        console.error("MySQL Deduct Money Error:", error);
        res.status(500).json({ message: "Failed to deduct money." });
    }
});

app.post('/api/player/:name/ban', async (req, res) => {
    const playerName = req.params.name;
    const { reason } = req.body;
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        await sampDbPool.query("INSERT INTO `bans` (`username`, `reason`) VALUES (?, ?)", [playerName, reason]);
        await sampDbPool.query("INSERT INTO `log_admin` (`date`, `description`) VALUES (NOW(), ?)", [`[ADMIN] Banned ${playerName} for: ${reason}`]);
        res.json({ message: 'Player banned successfully!' });
    } catch (error) {
        console.error("MySQL Ban Player Error:", error);
        res.status(500).json({ message: "Failed to ban player." });
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

app.get('/api/economy-stats', async (req, res) => {
    if (!sampDbPool) { return res.status(503).json({ message: "Game database is not connected." }); }
    try {
        const queries = [
            sampDbPool.query("SELECT SUM(cash) AS totalPlayerCash, SUM(bank) AS totalPlayerBank, SUM(hours) AS totalPlayerHours, MIN(hours) AS minPlayerHours, MAX(hours) AS maxPlayerHours, AVG(hours) AS avgPlayerHours, COUNT(CASE WHEN is_online = 1 THEN 1 END) AS onlinePlayers FROM users"),
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
            sampDbPool.query("SELECT gov_treasury FROM settings"),
            sampDbPool.query("SELECT SUM(price) as totalBusinessValue FROM businesses"),
            sampDbPool.query("SELECT SUM(price) as totalHouseValue FROM houses"),
            sampDbPool.query("SELECT SUM(price) as totalVehicleValue FROM vehicles")
        ];

        const results = await Promise.all(queries.map(p => p.catch(e => [[]])));

        const playerStats = results[0][0][0] || { totalPlayerCash: 0, totalPlayerBank: 0, totalPlayerHours: 0, minPlayerHours: 0, maxPlayerHours: 0, avgPlayerHours: 0, onlinePlayers: 0 };
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
        const totalBusinessValue = results[13][0][0] || { totalBusinessValue: 0 };
        const totalHouseValue = results[14][0][0] || { totalHouseValue: 0 };
        const totalVehicleValue = results[15][0][0] || { totalVehicleValue: 0 };
        
        const cashNum = parseInt(playerStats.totalPlayerCash) || 0;
        const bankNum = parseInt(playerStats.totalPlayerBank) || 0;
        const totalCirculation = cashNum + bankNum;
        
        const serverAssetValue = totalCirculation +
                                  (parseInt(totalBusinessValue.totalBusinessValue) || 0) +
                                  (parseInt(totalHouseValue.totalHouseValue) || 0) +
                                  (parseInt(totalVehicleValue.totalVehicleValue) || 0);

        res.json({
            totalCirculation,
            totalPlayerCash: cashNum,
            totalPlayerBank: bankNum,
            playerStats: {
                totalHours: parseInt(playerStats.totalPlayerHours) || 0,
                minHours: parseInt(playerStats.minPlayerHours) || 0,
                maxHours: parseInt(playerStats.maxPlayerHours) || 0,
                avgHours: parseFloat(playerStats.avgPlayerHours).toFixed(2) || 0,
                online: parseInt(playerStats.onlinePlayers) || 0
            },
            wealthDistribution, topVehicles,
            ownedBusinesses: ownedBusinessesCount.ownedBusinesses,
            totalBusinesses: totalBusinessesCount.totalBusinesses,
            totalBusinessCash: totalBusinessCashSum.totalBusinessCash || 0,
            wealthiestPlayers, topBusinesses, factionTreasuries,
            yesterdayCirculation: parseInt(yesterdayData.total_circulation) || 0,
            weekAgoCirculation: parseInt(weekAgoData.total_circulation) || 0,
            circulationHistory: historyData,
            governmentTreasury: governmentTreasury.gov_treasury,
            serverAssetValue
        });

    } catch (error) {
        console.error("MySQL Get Economy Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch economy statistics." });
    }
});

app.post('/api/gemini-analysis', async (req, res) => {
    const { circulationHistory, playerStats } = req.body;

    if (!circulationHistory || circulationHistory.length < 2) {
        return res.json({ prediction: 0, explanation: "Not enough data for a prediction." });
    }

    // --- Enhanced Factors ---
    // 1. Recent Circulation Trend (Weight: 40%)
    const latestCirculation = circulationHistory[circulationHistory.length - 1].total_circulation;
    const previousCirculation = circulationHistory[circulationHistory.length - 2].total_circulation;
    if (previousCirculation === 0) {
        return res.json({ prediction: 0, explanation: "Cannot calculate prediction due to zero previous circulation." });
    }
    const circulationChange = (latestCirculation - previousCirculation) / previousCirculation;

    // 2. Player Engagement Score (Weight: 20%)
    const engagementRatio = (playerStats.avgHours / (playerStats.maxHours || 1));
    const engagementScore = (engagementRatio - 0.5) * 0.1;

    // 3. Current Activity Level (Weight: 15%)
    const activityLevel = (playerStats.online / 100) * 0.05;

    // 4. Job Market Health (Weight: 15%)
    const [jobLogs] = await sampDbPool.query("SELECT description, created_at FROM log_jobs WHERE created_at >= NOW() - INTERVAL 24 HOUR");
    const recentPayouts = jobLogs.reduce((sum, log) => {
        const match = log.description.match(/got paid (\d+)/);
        return sum + (match ? parseInt(match[1], 10) : 0);
    }, 0);
    const jobMarketFactor = (recentPayouts / 1000000) * 0.02; // 2% boost for every ₦1,000,000 in payouts

    // 5. Player Acquisition Rate (Weight: 5%)
    const newPlayersToday = await db.collection('waitlist').countDocuments({ date: { $gte: new Date(new Date() - 24 * 60 * 60 * 1000) } });
    const acquisitionFactor = (newPlayersToday / 50) * 0.01; // 1% boost for every 50 new players

    // 6. Donation Velocity (Weight: 5%)
    const recentDonations = await db.collection('donations').find({ date: { $gte: new Date(new Date() - 24 * 60 * 60 * 1000) } }).toArray();
    const totalDonationAmount = recentDonations.reduce((sum, donation) => sum + parseInt(donation.price.replace(/[^0-9]/g, ''), 10), 0);
    const donationFactor = (totalDonationAmount / 50000) * 0.01; // 1% boost for every ₦50,000 in donations

    // --- Prediction Calculation (Weighted) ---
    const prediction = (circulationChange * 100 * 0.4) + 
                       (engagementScore * 100 * 0.2) + 
                       (activityLevel * 100 * 0.15) +
                       (jobMarketFactor * 100 * 0.15) +
                       (acquisitionFactor * 100 * 0.05) +
                       (donationFactor * 100 * 0.05);
    
    const explanation = `
        This simulated prediction is based on a weighted analysis of key server metrics:
        ---
        **Economic Trend (40%):** The total money in circulation changed by ${(circulationChange * 100).toFixed(2)}% in the last 24 hours.
        ---
        **Player Engagement (20%):** The average player has ${playerStats.avgHours} hours logged, indicating a dedicated player base. This contributes a ${(engagementScore * 100).toFixed(2)}% adjustment.
        ---
        **Player Activity (15%):** With ${playerStats.online} players currently active, the server's immediate health adjusts the prediction by ${(activityLevel * 100).toFixed(2)}% adjustment.
        ---
        **Job Market (15%):** A total of ₦${recentPayouts.toLocaleString()} was paid out from jobs in the last 24 hours, adding a ${(jobMarketFactor * 100).toFixed(2)}% boost.
        ---
        **Growth (5%):** ${newPlayersToday} new players have applied in the last 24 hours, resulting in a ${(acquisitionFactor * 100).toFixed(2)}% adjustment.
        ---
        **Community Investment (5%):** Recent donations totaling ₦${totalDonationAmount.toLocaleString()} provide a ${(donationFactor * 100).toFixed(2)}% indicator of positive sentiment.
        ---
        Combining these factors results in a simulated prediction of a ${prediction.toFixed(2)}% change in total circulation over the next 24 hours.
    `;

    res.json({ prediction: prediction.toFixed(2), explanation });
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
        await sampDbPool.query("INSERT INTO `events` (`title`, `description`, `event_date`, `announcement_date`) VALUES (?, ?, ?, ?)", [title, description, event_date, announcement_date || null]);
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
        const [updateResult] = await sampDbPool.query("UPDATE `users` SET `bank` = `bank` + ? WHERE `username` = ?", [amount, playerName]);
        if(updateResult.affectedRows > 0){
            await sampDbPool.query("INSERT INTO `log_admin` (`date`, `description`) VALUES (NOW(), ?)", [`[EVENT] Paid ${playerName} $${parseInt(amount).toLocaleString()} for: ${reason}`]);
             res.json({ message: 'Payment successful!' });
        } else {
             res.status(404).json({ message: "Player not found." });
        }
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
        if(rows.length > 0){
             res.json(rows[0]);
        } else {
            res.status(404).json({ message: "No players found in the database." });
        }
    } catch (error) {
        console.error("MySQL Get Random Player Error:", error);
        res.status(500).json({ message: "Failed to fetch random player." });
    }
});

app.post('/api/quick-announcement', async (req, res) => {
    const { embed } = req.body;
    sendToDiscord(EVENTS_WEBHOOK_URL, embed);
    res.status(200).json({ message: 'Announcement sent!' });
});

// --- NEW JOB & PAYCHECK LOGS ENDPOINTS ---
const JOBS = ["MINING", "MEAT CHOPPING", "PACKAGING", "GARBAGE", "LUMBER JACK", "DELIVERY", "COURIER", "FOLKLIFTING", "FOODPANDA", "FARMING"];

app.get('/api/job-logs', async (req, res) => {
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;
    try {
        const [logs] = await sampDbPool.query(`SELECT description, created_at FROM log_jobs ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]);
        const [[{ count }]] = await sampDbPool.query(`SELECT COUNT(*) as count FROM log_jobs`);
        res.json({ logs, totalPages: Math.ceil(count / limit), currentPage: page });
    } catch (error) {
        console.error(`MySQL Get Job Logs Error:`, error);
        res.status(500).json({ message: `Failed to fetch job logs.` });
    }
});

app.get('/api/job-payouts', async (req, res) => {
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        const [rows] = await sampDbPool.query("SELECT description FROM log_jobs");
        const payouts = {};

        JOBS.forEach(job => {
            payouts[job] = rows
                .filter(row => row.description.toUpperCase().includes(job))
                .reduce((sum, row) => {
                    const match = row.description.match(/got paid (\d+)/);
                    return sum + (match ? parseInt(match[1], 10) : 0);
                }, 0);
        });

        res.json(payouts);
    } catch (error) {
        console.error("MySQL Get Job Payouts Error:", error);
        res.status(500).json({ message: "Failed to fetch job payouts." });
    }
});


app.get('/api/player-job-logs/:name', async (req, res) => {
    const playerName = req.params.name;
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });

    try {
        const [logs] = await sampDbPool.query("SELECT description, created_at FROM log_jobs WHERE description LIKE ? ORDER BY created_at DESC", [`%${playerName}%`]);
        res.json(logs);
    } catch (error) {
        console.error("MySQL Get Player Job Logs Error:", error);
        res.status(500).json({ message: "Failed to fetch player job logs." });
    }
});

app.get('/api/paycheck-logs', async (req, res) => {
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });

    const page = parseInt(req.query.page) || 1;
    const date = req.query.date;
    const limit = 50;
    const offset = (page - 1) * limit;

    try {
        let whereClause = '';
        let queryParams = [limit, offset];
        let countQueryParams = [];

        if (date) {
            whereClause = "WHERE DATE(log_date) = ?";
            queryParams = [date, limit, offset];
            countQueryParams = [date];
        }

        const [logs] = await sampDbPool.query(`SELECT log_date, log_hour, total_amount FROM paycheck_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, queryParams);
        const [[{ count }]] = await sampDbPool.query(`SELECT COUNT(*) as count FROM paycheck_logs ${whereClause}`, countQueryParams);
        
        let dailyTotal = 0;
        if (date) {
            const [[{ total }]] = await sampDbPool.query(`SELECT SUM(total_amount) as total FROM paycheck_logs ${whereClause}`, countQueryParams);
            dailyTotal = total || 0;
        }

        res.json({
            logs,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            dailyTotal
        });
    } catch (error) {
        console.error(`MySQL Get Paycheck Logs Error:`, error);
        res.status(500).json({ message: `Failed to fetch paycheck logs.` });
    }
});

app.get('/api/paycheck-payout-total', async (req, res) => {
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    try {
        const [[{ total }]] = await sampDbPool.query("SELECT SUM(total_amount) as total FROM paycheck_logs");
        res.json({ total: total || 0 });
    } catch (error) {
        console.error("MySQL Get Total Paycheck Payout Error:", error);
        res.status(500).json({ message: "Failed to fetch total paycheck payout." });
    }
});

app.get('/api/transaction-logs', async (req, res) => {
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const limit = 50;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let queryParams = [limit, offset];
    let countQueryParams = [];

    if(search) {
        whereClause = "WHERE player_name LIKE ?";
        const searchTerm = `%${search}%`;
        queryParams = [searchTerm, limit, offset];
        countQueryParams = [searchTerm];
    }
    
    try {
        const [logs] = await sampDbPool.query(`SELECT player_name, amount, description, created_at FROM log_transaction ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, queryParams);
        const [[{ count }]] = await sampDbPool.query(`SELECT COUNT(*) as count FROM log_transaction ${whereClause}`, countQueryParams);
        res.json({ logs, totalPages: Math.ceil(count / limit), currentPage: page });
    } catch (error) {
        console.error("MySQL Get Transaction Logs Error:", error);
        res.status(500).json({ message: "Failed to fetch transaction logs." });
    }
});

app.get('/api/property-logs', async (req, res) => {
    if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const limit = 50;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let queryParams = [limit, offset];
    let countQueryParams = [];

    if(search) {
        whereClause = "WHERE description LIKE ?";
        const searchTerm = `%${search}%`;
        queryParams = [searchTerm, limit, offset];
        countQueryParams = [searchTerm];
    }
    
    try {
        const [logs] = await sampDbPool.query(`SELECT date, description FROM log_property ${whereClause} ORDER BY date DESC LIMIT ? OFFSET ?`, queryParams);
        const [[{ count }]] = await sampDbPool.query(`SELECT COUNT(*) as count FROM log_property ${whereClause}`, countQueryParams);
        res.json({ logs, totalPages: Math.ceil(count / limit), currentPage: page });
    } catch (error) {
        console.error("MySQL Get Property Logs Error:", error);
        res.status(500).json({ message: "Failed to fetch property logs." });
    }
});

// --- SERVER AND CRON JOB START ---
Promise.all([connectToMongo(), connectToSampDb()]).then(() => {
    app.use('/api', factionRoutes(sampDbPool));

    app.listen(PORT, () => {
        console.log(`Server started on port ${PORT}`);

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
        
        cron.schedule('* * * * *', async () => {
            try {
                if (!sampDbPool) { return; }
                const [events] = await sampDbPool.query("SELECT * FROM `events` WHERE `sent` = 0 AND `announcement_date` IS NOT NULL AND `announcement_date` <= NOW()");
                for (const event of events) {
                        const eventEmbed = {
                            title: `🔔 Upcoming Event: ${event.title}`,
                            description: event.description,
                            color: 0x5865F2,
                            fields: [
                                { name: "Event Date & Time", value: new Date(event.event_date).toLocaleString('en-US', { timeZone: 'Africa/Lagos' }) }
                            ],
                            footer: { text: "Mark your calendars!" }
                        };
                        sendToDiscord(EVENTS_WEBHOOK_URL, eventEmbed);
                        await sampDbPool.query("UPDATE `events` SET `sent` = 1 WHERE `id` = ?", [event.id]);
                        console.log(`Sent announcement for event: ${event.title}`);
                }
            } catch(e){
                console.error("Error in announcement cron job:", e);
            }
        });
    });
}).catch(err => {
    console.error("Failed to initialize databases and start server.", err);
});