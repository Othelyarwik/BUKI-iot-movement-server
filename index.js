const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');

const app = express();

// Simple CORS
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static('public'));

// In-memory sessions
const sessions = {};

// Clean up expired sessions every 2 minutes
setInterval(() => {
    const now = Date.now();
    Object.keys(sessions).forEach(token => {
        if (now - sessions[token].ts > 120000) {
            delete sessions[token];
        }
    });
}, 120000);

// Serve the phone interface
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Create new session
app.post('/start', (req, res) => {
    const token = nanoid(8);
    sessions[token] = { x: 0, y: 0, ts: Date.now() };
    console.log(`Created session: ${token}`);
    res.json({ token });
});

// Update phone movement data
app.post('/update', (req, res) => {
    const { token, x, y } = req.body;
    if (sessions[token]) {
        sessions[token] = { x: parseFloat(x) || 0, y: parseFloat(y) || 0, ts: Date.now() };
        res.json({ ok: true });
    } else {
        res.status(400).json({ error: 'Invalid token' });
    }
});

// Get X movement for PictoBlox
app.get('/x/:token', (req, res) => {
    const requestedToken = req.params.token;
    console.log(`X endpoint called with token: ${requestedToken}`);
    console.log(`Available sessions: ${Object.keys(sessions)}`);
    
    const session = sessions[requestedToken];
    
    if (!session) {
        console.log(`❌ No session found for token: ${requestedToken}`);
        res.set('Content-Type', 'text/plain');
        res.end('0');
        return;
    }
    
    const age = Date.now() - session.ts;
    console.log(`Session age: ${age}ms`);
    
    if (age >= 60000) {
        console.log(`❌ Session expired for token: ${requestedToken}`);
        delete sessions[requestedToken];
        res.set('Content-Type', 'text/plain');
        res.end('0');
        return;
    }
    
    const movement = Math.max(-5, Math.min(5, Math.round(session.x * 0.5)));
    console.log(`✅ X endpoint returning: ${movement} (from session.x: ${session.x})`);
    res.set('Content-Type', 'text/plain');
    res.end(movement.toString());
});

// Debug endpoint to see all sessions
app.get('/debug/:token', (req, res) => {
    const requestedToken = req.params.token;
    const session = sessions[requestedToken];
    
    const debugInfo = {
        requestedToken,
        sessionExists: !!session,
        sessionData: session,
        allTokens: Object.keys(sessions),
        currentTime: Date.now()
    };
    
    console.log('Debug info:', debugInfo);
    res.json(debugInfo);
});

// Get Y movement for PictoBlox  
app.get('/y/:token', (req, res) => {
    console.log(`Y endpoint called with token: ${req.params.token}`);
    const session = sessions[req.params.token];
    
    if (session && Date.now() - session.ts < 60000) {
        const movement = Math.max(-5, Math.min(5, Math.round(session.y * 0.5)));
        console.log(`Y endpoint returning: ${movement}`);
        res.set('Content-Type', 'text/plain');
        res.end(movement.toString());
    } else {
        console.log(`Y endpoint returning default: 0`);
        res.set('Content-Type', 'text/plain');  
        res.end('0');
    }
});

// Test endpoint to verify server is working
app.get('/test', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.end('Server is working!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
