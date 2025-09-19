const express = require('express');
const router = express.Router();

// This function will be called in server.js to pass the database pool
function factionRoutes(sampDbPool) {
    // A map to easily get faction names. Add more as needed.
    const FACTION_NAMES = {
        1: "Police",
        2: "Medic/Fire",
        4: "Government",
        5: "Mechanic",
        16: "EFCC"
    };

    /**
     * Endpoint to get key stats and the member list for a specific faction.
     */
    router.get('/faction-data/:factionId', async (req, res) => {
        const { factionId } = req.params;
        const id = parseInt(factionId);
        
        if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
        if (!FACTION_NAMES[id]) return res.status(400).json({ message: "Invalid Faction ID." });

        try {
            // Run queries in parallel for efficiency
            const [treasuryResult, membersResult] = await Promise.all([
                sampDbPool.query("SELECT faction_treasury FROM factions WHERE id = ?", [id]),
                sampDbPool.query("SELECT username, factionrank FROM users WHERE faction = ? ORDER BY factionrank DESC", [id])
            ]);

            const treasury = treasuryResult[0][0] ? treasuryResult[0][0].faction_treasury : 0;
            const members = membersResult[0];

            res.json({
                totalMembers: members.length,
                factionTreasury: treasury,
                memberList: members
            });

        } catch (error) {
            console.error(`Error fetching faction data for ID ${id}:`, error);
            res.status(500).json({ message: "Failed to fetch faction data." });
        }
    });

    /**
     * Endpoint for paginated, filtered faction logs.
     * It finds all members of a faction and then searches the log for any entries mentioning them.
     */
    router.get('/faction-logs/:factionId', async (req, res) => {
        const { factionId } = req.params;
        const id = parseInt(factionId);
        const page = parseInt(req.query.page) || 1;
        const limit = 50;
        const offset = (page - 1) * limit;

        if (!sampDbPool) return res.status(503).json({ message: "Game database is not connected." });
        
        try {
            // First, get all members of the specified faction
            const [members] = await sampDbPool.query("SELECT username FROM users WHERE faction = ?", [id]);
            const memberNames = members.map(m => m.username);

            // If there are no members, there can be no logs
            if (memberNames.length === 0) {
                 return res.json({ logs: [], totalCount: 0, totalPages: 0, currentPage: 1 });
            }

            // Dynamically create 'LIKE' clauses for each member name
            const whereClauses = memberNames.map(() => '`description` LIKE ?').join(' OR ');
            
            // Fetch the paginated logs
            const logQueryParams = [...memberNames.map(name => `%${name}%`), limit, offset];
            const [logs] = await sampDbPool.query(`SELECT date, description FROM \`log_faction\` WHERE ${whereClauses} ORDER BY date DESC LIMIT ? OFFSET ?`, logQueryParams);
            
            // Get the total count of matching logs for pagination
            const countQueryParams = memberNames.map(name => `%${name}%`);
            const [[{ count }]] = await sampDbPool.query(`SELECT COUNT(*) as count FROM \`log_faction\` WHERE ${whereClauses}`, countQueryParams);
            
            res.json({ logs, totalCount: count, totalPages: Math.ceil(count / limit), currentPage: page });
        } catch (error) {
            console.error(`MySQL Get Faction Logs Error:`, error);
            res.status(500).json({ message: `Failed to fetch faction logs.` });
        }
    });
    
    return router;
}

module.exports = factionRoutes;

