const express = require('express');
const cors = require('cors');
const Rcon = require('samp-rcon');

const app = express();
// Render sets the PORT environment variable, so we use that.
const PORT = process.env.PORT || 3001; 

app.use(cors());
app.use(express.json());

// --- RCON Connection Details ---
const rconOptions = {
    host: '217.182.175.212',
    port: 28071, // Your server's port
    password: '10903f2478b10a37' // IMPORTANT: Replace with your actual RCON password
};

// Log the options to ensure they are correct on Render's side
console.log('--- RCON Options ---');
console.log(`Host: ${rconOptions.host} (Type: ${typeof rconOptions.host})`);
console.log(`Port: ${rconOptions.port} (Type: ${typeof rconOptions.port})`);
console.log(`Password is set: ${!!rconOptions.password && rconOptions.password !== '10903f2478b10a37'}`);
console.log('--------------------');

// Validate the options before attempting to create a connection
if (!rconOptions.host || typeof rconOptions.host !== 'string') {
    throw new Error('SAMP_HOST is not defined or is not a string. Deployment cannot continue.');
}
if (!rconOptions.password || rconOptions.password === '10903f2478b10a37') {
    throw new Error('RCON_PASSWORD is not defined. Please set it as an environment variable in Render.');
}

// ** THE FIX IS HERE: **
// We now pass the options as separate arguments, as the library's constructor expects.
const rcon = new Rcon(rconOptions.host, rconOptions.port, rconOptions.password);


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