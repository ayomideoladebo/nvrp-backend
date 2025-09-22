const express = require('express');
const cors = require('cors');
const Rcon = require('samp-rcon');

const app = express();
// Render sets the PORT environment variable, so we use that.
const PORT = process.env.PORT || 3001; 

app.use(cors());
app.use(express.json());

// --- RCON Connection Details ---
// All values are hardcoded as requested.
const rconOptions = {
    host: '217.182.175.212',
    port: 28071, // Your server's RCON port
    password: '10903f2478b10a37'
};

// Log the options to ensure they are correct on Render's side
console.log('--- RCON Options ---');
console.log(`Host: ${rconOptions.host} (Type: ${typeof rconOptions.host})`);
console.log(`Port: ${rconOptions.port} (Type: ${typeof rconOptions.port})`);
console.log('--------------------');

// Pass the options as separate arguments, as the library's constructor expects.
const rcon = new Rcon(rconOptions.host, rconOptions.port, rconOptions.password);


// Endpoint to get the player list in a structured format
app.get('/api/rcon/players', async (req, res) => {
    try {
        const players = await rcon.getPlayers();
        res.json({ players: players.players || [] });
    } catch (error) {
        console.error('RCON getPlayers Error:', error);
        res.status(500).json({ error: 'Failed to get player list', details: error.message });
    }
});

// Generic endpoint for sending any other RCON command
app.post('/api/rcon/command', async (req, res) => {
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ error: 'Command not provided' });
    }

    try {
        const response = await rcon.send(command);
        res.json({ response });
    } catch (error) {
        console.error('RCON command Error:', error);
        res.status(500).json({ error: 'Failed to send RCON command', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Admin panel RCON service is running on port ${PORT}`);
});