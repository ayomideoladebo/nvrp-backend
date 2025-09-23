const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// --- Database Connection ---
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

// --- Helper function to safely execute queries ---
// This will prevent a single bad query from crashing the whole server.
async function safeQuery(query, params = []) {
    try {
        const [results] = await sampDbPool.query(query, params);
        return results;
    } catch (error) {
        console.error(`--- QUERY FAILED ---`);
        console.error(`Query: ${query}`);
        console.error(`Error: ${error.message}`);
        console.error(`--------------------`);
        return null; // Return null on error instead of crashing
    }
}


// --- Main Data Endpoint ---
app.get('/api/economy/all-stats', async (req, res) => {
    if (!sampDbPool) {
        return res.status(503).json({ message: "Database service is not available." });
    }
    
    try {
        const playerStats = await safeQuery("SELECT COUNT(*) as totalPlayers, (SELECT COUNT(*) FROM users WHERE last_seen >= CURDATE()) as playersToday FROM users");
        const wealthStats = await safeQuery("SELECT username, (cash + bank) as total_wealth FROM users ORDER BY total_wealth DESC LIMIT 1");
        const assetValues = await safeQuery(`
            SELECT 
                (SELECT SUM(cash + bank) FROM users) as playerLiquid,
                (SELECT SUM(price) FROM vehicles WHERE owner != '' AND price > 0) as vehicles,
                (SELECT SUM(price) FROM houses WHERE ownerid != -1) as houses,
                (SELECT SUM(price) FROM businesses WHERE ownerid != 0) as businesses
        `);
        const topVehicles = await safeQuery("SELECT modelid, COUNT(*) as count FROM vehicles WHERE price > 50000 AND owner != '' GROUP BY modelid ORDER BY count DESC LIMIT 5");
        const totalPlayersResult = await safeQuery("SELECT COUNT(*) as count FROM users");
        
        const totalPlayers = totalPlayersResult ? totalPlayersResult[0].count : 0;
        const top10PercentCount = Math.ceil(totalPlayers * 0.1);
        
        const top10PercentWealth = await safeQuery("SELECT SUM(cash + bank) as topWealth FROM (SELECT cash, bank FROM users ORDER BY (cash + bank) DESC LIMIT ?) as top_users", [top10PercentCount]);
        
        const topMiners = await safeQuery("SELECT SUBSTRING_INDEX(description, ' got paid', 1) as player, SUM(CAST(REGEXP_SUBSTR(description, '[0-9]+') AS UNSIGNED)) as total FROM log_jobs WHERE description LIKE '%MINING%' GROUP BY player ORDER BY total DESC LIMIT 5");
        const topFarmers = await safeQuery("SELECT SUBSTRING_INDEX(description, ' got paid', 1) as player, SUM(CAST(REGEXP_SUBSTR(description, '[0-9]+') AS UNSIGNED)) as total FROM log_jobs WHERE description LIKE '%FARMING%' GROUP BY player ORDER BY total DESC LIMIT 5");
        const topMeatChoppers = await safeQuery("SELECT SUBSTRING_INDEX(description, ' got paid', 1) as player, SUM(CAST(REGEXP_SUBSTR(description, '[0-9]+') AS UNSIGNED)) as total FROM log_jobs WHERE description LIKE '%MEAT CHOPPING%' GROUP BY player ORDER BY total DESC LIMIT 5");
        const businessMagnates = await safeQuery("SELECT username as player, COUNT(id) as business_count FROM businesses JOIN users ON ownerid = id WHERE ownerid != 0 GROUP BY username ORDER BY business_count DESC LIMIT 5");
        const highRollers = await safeQuery("SELECT username, (cash + bank) as wealth, hours FROM users ORDER BY wealth DESC, hours ASC LIMIT 5");
        const grinders = await safeQuery("SELECT username, (cash + bank) as wealth, hours FROM users ORDER BY hours DESC, wealth ASC LIMIT 5");
        
        res.json({
            keyMetrics: {
                totalPlayers: playerStats ? playerStats[0].totalPlayers : 0,
                playersToday: playerStats ? playerStats[0].playersToday : 0,
                totalWealth: assetValues ? assetValues[0].playerLiquid : 0,
                richestPlayer: wealthStats ? wealthStats[0] : { username: 'N/A' }
            },
            assetDistribution: {
                playerLiquid: assetValues ? parseInt(assetValues[0].playerLiquid) : 0,
                vehicles: assetValues ? parseInt(assetValues[0].vehicles) : 0,
                houses: assetValues ? parseInt(assetValues[0].houses) : 0,
                businesses: assetValues ? parseInt(assetValues[0].businesses) : 0,
            },
            endGameAssets: {
                topVehicles
            },
            assetInequality: {
                top10PercentTotal: top10PercentWealth ? top10PercentWealth[0].topWealth : 0,
                serverTotal: assetValues ? assetValues[0].playerLiquid : 0
            },
            playerArchetypes: {
                topMiners,
                topFarmers,
                topMeatChoppers,
                businessMagnates,
                highRollers,
                grinders
            }
        });

    } catch (error) {
        console.error("Critical Error in /api/economy/all-stats endpoint:", error);
        res.status(500).json({ message: "A critical error occurred while processing the request.", error: error.message });
    }
});


// --- Server Startup ---
async function startServer() {
    try {
        sampDbPool = mysql.createPool(dbConfig);
        await sampDbPool.getConnection(); // Test connection
        console.log('Successfully connected to the SA-MP database.');
        
        app.listen(PORT, () => {
            console.log(`Economy dashboard backend is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to connect to the SA-MP database:', error);
        process.exit(1); 
    }
}

startServer();