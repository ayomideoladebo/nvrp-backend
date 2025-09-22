const express = require('express');
const cors = require('cors');
const dgram = require('dgram'); // Node.js's built-in module for UDP

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- RCON Connection Details ---
const RCON_CONFIG = {
    host: '217.182.175.212',
    port: 28071,
    password: '10903f2478b10a37'
};

/**
 * Sends a command to the SA-MP server using the RCON protocol.
 * This is a custom implementation and does not require external libraries.
 * @param {string} command The RCON command to send.
 * @returns {Promise<string>} The server's response.
 */
function sendRcon(command) {
    return new Promise((resolve, reject) => {
        const client = dgram.createSocket('udp4');
        const password = RCON_CONFIG.password;
        
        // RCON Packet Structure:
        // 4 bytes: 'SAMP'
        // 4 bytes: Server IP octets
        // 2 bytes: Server Port
        // 1 byte:  Opcode ('x' for rcon)
        // 2 bytes: Password length
        // N bytes: Password
        // 2 bytes: Command length
        // N bytes: Command
        const packetHeader = Buffer.alloc(11);
        packetHeader.write('SAMP');
        const ipParts = RCON_CONFIG.host.split('.').map(Number);
        packetHeader[4] = ipParts[0];
        packetHeader[5] = ipParts[1];
        packetHeader[6] = ipParts[2];
        packetHeader[7] = ipParts[3];
        packetHeader.writeUInt16LE(RCON_CONFIG.port, 8);
        packetHeader[10] = 'x'.charCodeAt(0);

        const passBuffer = Buffer.from(password);
        const passLenBuffer = Buffer.alloc(2);
        passLenBuffer.writeUInt16LE(password.length, 0);

        const cmdBuffer = Buffer.from(command);
        const cmdLenBuffer = Buffer.alloc(2);
        cmdLenBuffer.writeUInt16LE(command.length, 0);

        const packet = Buffer.concat([packetHeader, passLenBuffer, passBuffer, cmdLenBuffer, cmdBuffer]);
        
        // Handle server response
        client.on('message', (msg) => {
            client.close();
            // The actual response starts at offset 11
            resolve(msg.toString('ascii', 11));
        });

        // Send the packet
        client.send(packet, 0, packet.length, RCON_CONFIG.port, RCON_CONFIG.host, (err) => {
            if (err) {
                client.close();
                reject(err);
            }
        });

        // Timeout if no response after 3 seconds
        setTimeout(() => {
            try {
                client.close();
            } finally {
                reject(new Error('RCON request timed out. (Check firewall/port)'));
            }
        }, 3000);
    });
}

// --- API Endpoints ---

app.get('/', (req, res) => {
    res.status(200).json({ status: 'RCON Service is running' });
});

app.post('/api/rcon/command', async (req, res) => {
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ error: 'Command not provided' });
    }
    
    try {
        const response = await sendRcon(command);
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