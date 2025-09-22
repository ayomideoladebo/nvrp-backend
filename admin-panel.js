const express = require('express');
const cors = require('cors');
const Rcon = require('samp-rcon');

const app = express();
const PORT = 3001; // Running on a different port to avoid conflicts

app.use(cors());
app.use(express.json());

const rcon = new Rcon({
    host: '217.182.175.212',
    port: 28071, // Your server's port
    password: '10903f2478b10a37' // IMPORTANT: Replace with your actual RCON password
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
                const [id, name, score, ping] = line.trim().split(/\s+/);
                return { id, name, score, ping };
            });
            res.json({ players });
        } else {
            res.json({ response });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to send RCON command' });
    }
});

app.listen(PORT, () => {
    console.log(`Admin panel server running on port ${PORT}`);
});