const express = require('express');
const cors = require('cors');
const Rcon = require('samp-rcon');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const rcon = new Rcon({
    host: '217.182.175.212',
    port: 28071, // Ensure this is your server's RCON port
    password: '10903f2478b10a37' // !!! IMPORTANT: Replace with your actual RCON password from server.cfg !!!
});

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
            }).filter(p => p !== null); // Filter out any lines that couldn't be parsed
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
    console.log(`Admin panel RCON service running on port ${PORT}`);
});