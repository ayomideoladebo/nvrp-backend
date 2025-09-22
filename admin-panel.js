const express = require('express');
const cors = require('cors');
const Rcon = require('samp-rcon');

const app = express();
const PORT = process.env.PORT || 3001; 

app.use(cors());
app.use(express.json());

// --- RCON Connection Details ---
const rconOptions = {
    host: '217.182.175.212',
    port: 28071,
    password: '10903f2478b10a37'
};

console.log('--- RCON Service Starting ---');
console.log(`Attempting to connect to RCON at ${rconOptions.host}:${rconOptions.port}`);

let rcon;
let rconError = null;

try {
    rcon = new Rcon(rconOptions.host, rconOptions.port, rconOptions.password);
    console.log('RCON object initialized successfully.');

    // Add event listeners for more insight
    rcon.on('ready', () => {
        console.log('RCON connection SUCCESS: Connection is ready!');
    });

    rcon.on('error', (err) => {
        console.error('RCON connection RUNTIME ERROR:', err);
        rconError = err; // Store the error
    });

} catch (error) {
    console.error('FATAL: Failed to initialize RCON object.', error);
    rconError = error; // Store the initialization error
}

// Health Check Endpoint - Helps us see if the server is running
app.get('/', (req, res) => {
    res.status(200).json({ 
        status: 'RCON Service is running', 
        rcon_initialized: !!rcon,
        rcon_connection_error: rconError ? rconError.message : null
    });
});

// Endpoint to get the player list
app.get('/api/rcon/players', async (req, res) => {
    console.log('Received request for /api/rcon/players');
    if (!rcon) {
        console.error('/api/rcon/players: RCON not initialized.');
        return res.status(500).json({ error: 'RCON service is not initialized.' });
    }

    try {
        const players = await rcon.getPlayers();
        console.log('Successfully fetched players:', players);
        res.json({ players: players.players || [] });
    } catch (error) {
        console.error('RCON getPlayers Error:', error);
        res.status(500).json({ error: 'Failed to get player list', details: error.message });
    }
});

// Generic endpoint for other commands
app.post('/api/rcon/command', async (req, res) => {
    const { command } = req.body;
    console.log(`Received request for /api/rcon/command: ${command}`);
    if (!rcon) {
        console.error('/api/rcon/command: RCON not initialized.');
        return res.status(500).json({ error: 'RCON service is not initialized.' });
    }
    if (!command) {
        return res.status(400).json({ error: 'Command not provided' });
    }

    try {
        const response = await rcon.send(command);
        console.log(`Response for command "${command}":`, response);
        res.json({ response });
    } catch (error) {
        console.error('RCON command Error:', error);
        res.status(500).json({ error: 'Failed to send RCON command', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Admin panel RCON service is running on port ${PORT}`);
});