const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const useragent = require('express-useragent');
const geoip = require('geoip-lite');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// --- DATABASE SETUP ---
const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({
  stats: { yesterday_peak: 0, page_views: 0 },
  announcement: { text: "Welcome to the live stream!", active: false },
  housemates: [ { name: "Gigi Jasmine", age: 31, bio: "A DJ and storyteller blending Nigerian and American cultures.", votes: 2341 }, { name: "Ivatar", age: 37, bio: "A DJ and TV host with a strong personality and South African roots.", votes: 1678 }, { name: "Zita", age: 24, bio: "A creative powerhouse from UNILAG, this model and artist lives with a YOLO attitude.", votes: 2105 }, { name: "Big Soso", age: 28, bio: "A lawyer-chef and charity founder who paid her way through school by cooking.", votes: 2876 }, { name: "Sultana", age: 26, bio: "A plus-size model and beautician from Adamawa State, an eccentric soul who loves to travel.", votes: 1300 }, { name: "Mide", age: 23, bio: "An actress with sharp intuition, known for her unfiltered realness and born for the spotlight.", votes: 1050 }, { name: "Dede", age: 23, bio: "Fiercely focused and competitive to her core, she has a deep and loyal family bond.", votes: 2650 }, { name: "Doris", age: 34, bio: "A radio presenter and writer who calls herself a 'firecracker', ready to embrace chaos and fun.", votes: 990 }, { name: "Joanna", age: 21, bio: "A two-time pageant queen, she sees herself as a mirror reflecting strength and truth.", votes: 1123 }, { name: "Isabella", age: 29, bio: "A mom and actress described as 'sweet like honey, sharp like a sting,' guided by her faith.", votes: 987 }, { name: "Imisi", age: 23, bio: "A fashion designer and actress with a bold heart, she grew up assertive and is ready to be remembered.", votes: 1150 }, { name: "Thelma Lawson", age: 27, bio: "A skincare entrepreneur and single mom, a go-getter with loud confidence and emotional honesty.", votes: 1879 }, { name: "Ibifubara", age: 28, bio: "A trained psychologist who is witty, compassionate, and dramatic, passionate about mental health.", votes: 1287 }, { name: "Sabrina", age: 32, bio: "An actor, model, and TEDx speaker with a global perspective, described as calm and observant.", votes: 954 }, { name: "Tracy", age: 27, bio: "A fun, fierce, and self-proclaimed 'weird kid' who is incredibly loyal to her family and friends.", votes: 1234 }, { name: "Rooboy", age: 30, bio: "Bold and high-energy, his mom's loss reshaped him. He's blunt, loyal, and unapologetically real.", votes: 1543 }, { name: "Koyin", age: 21, bio: "A fashion-forward model and 'certified party plug', chasing success in music and acting.", votes: 1432 }, { name: "Danboskid", age: 25, bio: "Mr Ideal Nigeria 2024, a charismatic model and rising actor with a background in construction.", votes: 1345 }, { name: "Otega", age: 33, bio: "A multi-talented software developer, storyteller, chef, and photographer who values deep connections.", votes: 2987 }, { name: "Jason Jae", age: 29, bio: "A vibrant performer and 'lover boy with a wild side' who has bounced back from previous setbacks.", votes: 2750 }, { name: "Bright Morgan", age: 28, bio: "A fast-rising Nollywood actor and 'Lagos boy' known for his strategic mind and honesty.", votes: 2431 }, { name: "Denari", age: 27, bio: "A first-class graduate and natural leader, described as passionate and funny.", votes: 1765 }, { name: "Kuture", age: 27, bio: "An 'Ajegunle firecracker' with unfiltered energy, a talented drummer and interior designer.", votes: 1500 }, { name: "Mensan", age: 29, bio: "A lawyer, fashion icon, and compelling storyteller from Port Harcourt, ready to bring his A-game.", votes: 1800 }, { name: "Kaybobo", age: 26, bio: "A summa cum laude graduate with an athletic and poetic soul.", votes: 2011 }, { name: "Victory", age: 28, bio: "A bold realist and vibrant writer passionate about freedom and equality.", votes: 879 }, { name: "Purple", age: 25, bio: "Also known as Faith, he's a medical doctor and augmented reality creator blending science and art.", votes: 3102 }, { name: "Kayikunmi", age: 25, bio: "A charismatic twin who is a banker by day and runs a streetwear brand by night.", votes: 1098 }, { name: "Kola", age: 29, bio: "A calm and confident Quality Analyst, a grounded and stylish storyteller who values authenticity.", votes: 3541 } ]
}).write();

// --- SERVER SETUP ---
const app = express();
app.use(cors());
app.use(useragent.express());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- STATE VARIABLES ---
let viewerCount = 0;
let todayPeak = 0;
const stats = {
    topCountries: {},
    deviceTypes: { Desktop: 0, Mobile: 0, Other: 0 },
    referrers: {},
    viewerHistory: []
};

// --- AUTHENTICATION ---
const CREDENTIALS = { username: 'admin', password: 'password123' };

// --- API & SOCKET LOGIC ---
app.post('/login', (req, res) => { if (req.body.username === CREDENTIALS.username && req.body.password === CREDENTIALS.password) { res.status(200).json({ success: true }); } else { res.status(401).json({ success: false }); } });
app.get('/api/stats', (req, res) => { res.json({ yesterday_peak: db.get('stats.yesterday_peak').value(), page_views: db.get('stats.page_views').value() }); });
app.post('/api/announcement', (req, res) => { db.set('announcement', req.body).write(); io.emit('announcementUpdate', req.body); res.status(200).json({ success: true }); });
app.post('/api/vote', (req, res) => { const { housemateName } = req.body; if (housemateName) { db.get('housemates').find({ name: housemateName }).update('votes', n => n + 1).write(); io.emit('voteUpdate', db.get('housemates').value()); res.status(200).json({ success: true }); } });

io.on('connection', (socket) => {
    viewerCount++;
    if (viewerCount > todayPeak) todayPeak = viewerCount;
    db.update('stats.page_views', n => n + 1).write();

    const ua = socket.request.headers['user-agent'];
    const source = useragent.parse(ua);
    if (source.isMobile) stats.deviceTypes.Mobile++; else if (source.isDesktop) stats.deviceTypes.Desktop++; else stats.deviceTypes.Other++;
    
    const ip = socket.handshake.address.includes('::') ? '8.8.8.8' : socket.handshake.address;
    const geo = geoip.lookup(ip);
    if (geo && geo.country) stats.topCountries[geo.country] = (stats.topCountries[geo.country] || 0) + 1;

    const referer = socket.handshake.headers.referer || 'Direct';
    const domain = referer.includes('//') ? referer.split('/')[2] : 'Direct';
    stats.referrers[domain] = (stats.referrers[domain] || 0) + 1;

    socket.emit('announcementUpdate', db.get('announcement').value());
    socket.emit('voteUpdate', db.get('housemates').value());

    io.emit('statsUpdate', { viewerCount, todayPeak, ...stats, housemates: db.get('housemates').value() });
    
    socket.on('disconnect', () => { viewerCount--; io.emit('statsUpdate', { viewerCount, todayPeak, ...stats, housemates: db.get('housemates').value() }); });
});

// --- SCHEDULED TASKS ---
setInterval(() => {
    stats.viewerHistory.push(viewerCount);
    if (stats.viewerHistory.length > 60) stats.viewerHistory.shift();
    const now = new Date();
    if (now.getHours() === 23 && now.getMinutes() === 59) {
        db.set('stats.yesterday_peak', todayPeak).write();
        todayPeak = 0;
    }
}, 1000); // Update history every second

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
