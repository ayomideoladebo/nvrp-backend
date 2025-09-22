const express = require('express');
const cors = require('cors');
const samp = require('samp-query');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const options = {
    host: '217.182.175.212',
    port: 28071, // Your server's game port
    rcon_password: '10903f2478b10a37' // !!! IMPORTANT: Replace with your actual RCON password from server.cfg !!!
};

app.post('/api/rcon/command', async (req, res) => {
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ error: 'Command not provided' });
    }

    try {
        const response = await new Promise((resolve, reject) => {
            samp(options, (error, queryResponse) => {
                if (error) {
                    return reject(error);
                }
                
                if (command.toLowerCase() === 'players') {
                    resolve({ players: queryResponse.players || [] });
                } else {
                    queryResponse.rcon(command, (err, rconResponse) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve({ response: rconResponse });
                    });
                }
            });
        });
        res.json(response);
    } catch (error) {
        console.error('RCON Error:', error);
        res.status(500).json({ error: 'Failed to execute command', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Admin panel RCON service is running on port ${PORT}`);
});