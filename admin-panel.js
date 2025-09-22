const express = require('express');
const cors = require('cors');
const Rcon = require('samp-rcon');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Robust RCON Connection Setup ---
const rconOptions = {
    host: process.env.SAMP_HOST || '217.182.175.212',
    port: process.env.SAMP_PORT || 28071,
    password: process.env.RCON_PASSWORD || '10903f2478b10a37' // !!! IMPORTANT: Set RCON_PASSWORD as an environment variable on Render !!!
};

// Log the options to help debug on Render
console.log('--- RCON Options ---');
console.log(`Host: ${rconOptions.host} (Type: ${typeof rconOptions.host})`);
console.log(`Port: ${rconOptions.port} (Type: ${typeof rconOptions.port})`);
console.log(`Password is set: ${!!rconOptions.password}`);
console.log('--------------------');

if (!rconOptions.host || typeof rconOptions.host !== 'string') {
    throw new Error('SAMP_HOST is not defined or is not a string. Deployment cannot continue.');
}
if (!rconOptions.password) {
    throw new Error('RCON_PASSWORD is not defined. Deployment cannot continue.');
}

const rcon = new Rcon(rconOptions);

// Endpoint to get the player list
app.get('/api/rcon/players', async (req, res) => {
    try {
        const players = await rcon.getPlayers();
        res.json({ players: players.players || [] });
    } catch (error) {
        console.error('RCON getPlayers Error:', error);
        res.status(500).json({ error: 'Failed to get player list', details: error.message });
    }
});

// Generic endpoint for other commands
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