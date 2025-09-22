const express = require('express');
const cors = require('cors');
const Rcon = require('samp-rcon');

const app = express();
const PORT = process.env.PORT || 3001; // Render uses a dynamic port

app.use(cors());
app.use(express.json());

// --- RCON Connection Setup ---
// This configuration is more robust and prevents type errors during deployment.
const rconOptions = {
    host: String(process.env.SAMP_HOST || '217.182.175.212'),
    port: parseInt(process.env.SAMP_PORT || 28071, 10),
    password: String(process.env.RCON_PASSWORD || '10903f2478b10a37') // !!! IMPORTANT: For security, set this as an environment variable on Render !!!
};

console.log(`Attempting to connect to RCON at ${rconOptions.host}:${rconOptions.port}`);

const rcon = new Rcon(rconOptions);

app.post('/api/rcon/command', async (req, res) => {
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ error: 'Command not provided' });
    }

    try {
        const response = await rcon.send(command);

        if (command.toLowerCase() === 'players') {
            const players = response.split('\n').slice(1, -1).map(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 4) {
                    const [id, name, score, ping] = parts;
                    return { id, name, score, ping };
                }
                return null;
            }).filter(p => p !== null);
            res.json({ response, players });
        } else {
            res.json({ response });
        }
    } catch (error) {
        console.error('RCON Error:', error);
        res.status(500).json({ error: 'Failed to send RCON command', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Admin panel RCON service is running on port ${PORT}`);
});