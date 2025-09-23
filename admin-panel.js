const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
// Use a different port to avoid conflicts with your main server.js
const PORT = process.env.PORT || 3002; 

app.use(cors());
app.use(express.json());

// --- Database Connection ---
// Ensure these credentials are correct for your SA-MP database
const dbConfig = {
    host: '217.182.175.212',
    user: 'u3225914_Ur9bu1nnxG',
    password: '5WNZTyZSQkbv@ix5kif^AhzF',
    database: 's3225914_9javiberp',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let sampDbPool;

// --- Main Data Endpoint ---
// A single, powerful endpoint to fetch all stats for the dashboard
app.get('/api/economy/all-stats', async (req, res) => {
    if (!sampDbPool) {
        return res.status(503).json({ message: "Database service is not available." });
    }
    
    try {
        // Run all queries concurrently for maximum speed
        const [
            [[playerStats]],
            [[wealthStats]],
            [assetValues],
            [topVehicles],
            [[totalPlayersResult]],
            [topMiners],
            [topTruckers],
            [topCouriers],
            [businessMagnates],
            [highRollers],
            [grinders]
        ] = await Promise.all([
            sampDbPool.query("SELECT COUNT(*) as totalPlayers, (SELECT COUNT(*) FROM users WHERE last_seen >= CURDATE()) as playersToday FROM users"),
            sampDbPool.query("SELECT username, (cash + bank) as total_wealth FROM users ORDER BY total_wealth DESC LIMIT 1"),
            sampDbPool.query(`
                SELECT 
                    (SELECT SUM(cash + bank) FROM users) as playerLiquid,
                    (SELECT SUM(price) FROM vehicles WHERE owner != '' AND price > 0) as vehicles,
                    (SELECT SUM(price) FROM houses WHERE ownerid != -1) as houses,
                    (SELECT SUM(price) FROM businesses WHERE ownerid != 0) as businesses
            `),
            sampDbPool.query("SELECT model, COUNT(*) as count FROM vehicles WHERE price > 50000 AND owner != '' GROUP BY model ORDER BY count DESC LIMIT 5"),
            sampDbPool.query("SELECT COUNT(*) as count FROM users"),
            sampDbPool.query("SELECT SUBSTRING_INDEX(description, ' got paid', 1) as player, SUM(CAST(REGEXP_SUBSTR(description, '[0-9]+') AS UNSIGNED)) as total FROM log_job WHERE description LIKE '%MINING%' GROUP BY player ORDER BY total DESC LIMIT 5"),
            sampDbPool.query("SELECT SUBSTRING_INDEX(description, ' got paid', 1) as player, SUM(CAST(REGEXP_SUBSTR(description, '[0-9]+') AS UNSIGNED)) as total FROM log_job WHERE description LIKE '%DELIVERY%' GROUP BY player ORDER BY total DESC LIMIT 5"),
            sampDbPool.query("SELECT SUBSTRING_INDEX(description, ' got paid', 1) as player, SUM(CAST(REGEXP_SUBSTR(description, '[0-9]+') AS UNSIGNED)) as total FROM log_job WHERE description LIKE '%COURIER%' GROUP BY player ORDER BY total DESC LIMIT 5"),
            sampDbPool.query("SELECT u.username as player, COUNT(b.id) as business_count FROM businesses b JOIN users u ON b.ownerid = u.id WHERE b.ownerid != 0 GROUP BY u.username ORDER BY business_count DESC LIMIT 5"),
            sampDbPool.query("SELECT username, (cash + bank) as wealth, playtime FROM users ORDER BY wealth DESC, playtime ASC LIMIT 5"),
            sampDbPool.query("SELECT username, (cash + bank) as wealth, playtime FROM users ORDER BY playtime DESC, wealth ASC LIMIT 5")
        ]);

        const totalPlayers = totalPlayersResult.count;
        const top10PercentCount = Math.ceil(totalPlayers * 0.1);
        
        const [[top10PercentWealth]] = await sampDbPool.query("SELECT SUM(cash + bank) as topWealth FROM (SELECT cash, bank FROM users ORDER BY (cash + bank) DESC LIMIT ?) as top_users", [top10PercentCount]);
        
        res.json({
            keyMetrics: {
                totalPlayers: playerStats.totalPlayers,
                playersToday: playerStats.playersToday,
                totalWealth: assetValues.playerLiquid,
                richestPlayer: wealthStats
            },
            assetDistribution: {
                playerLiquid: parseInt(assetValues.playerLiquid) || 0,
                vehicles: parseInt(assetValues.vehicles) || 0,
                houses: parseInt(assetValues.houses) || 0,
                businesses: parseInt(assetValues.businesses) || 0,
            },
            endGameAssets: {
                topVehicles
            },
            assetInequality: {
                top10PercentTotal: top10PercentWealth.topWealth || 0,
                serverTotal: assetValues.playerLiquid || 0
            },
            playerArchetypes: {
                topMiners,
                topTruckers,
                topCouriers,
                businessMagnates,
                highRollers,
                grinders
            }
        });

    } catch (error) {
        console.error("SQL Get Advanced Economy Error:", error);
        res.status(500).json({ message: "Failed to fetch advanced economy stats.", error: error.message });
    }
});


// --- Server Startup ---
async function startServer() {
    try {
        sampDbPool = mysql.createPool(dbConfig);
        await sampDbPool.getConnection(); // Test connection
        console.log('Successfully connected to the SA-MP database.');
        
        app.listen(PORT, () => {
            console.log(`Economy dashboard backend is running on https://rcon-nvrp-backend.onrender.com:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to connect to the SA-MP database:', error);
        // Exit if we can't connect to the DB on startup
        process.exit(1); 
    }
}

startServer();
