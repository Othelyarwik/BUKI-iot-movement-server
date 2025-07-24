const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');

const app = express();

// Enhanced CORS configuration
app.use(cors({
    origin: true, // Allow all origins for testing
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, 
                req.body ? `Body: ${JSON.stringify(req.body)}` : '');
    next();
});

const sessions = {};

// Cleanup expired sessions every 5 minutes
setInterval(() => {
    const now = Date.now();
    Object.keys(sessions).forEach(token => {
        if (now - sessions[token].ts > 300000) { // 5 minutes
            delete sessions[token];
            console.log(`Cleaned up expired session: ${token}`);
        }
    });
}, 300000);

app.get('/', (req, res) => {
    console.log('Serving index.html');
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        activeSessions: Object.keys(sessions).length
    });
});

app.post('/start', (req, res) => {
    try {
        const token = nanoid(8);
        sessions[token] = { x: 0, y: 0, ts: Date.now() };
        console.log(`Created new session with token: ${token}`);
        res.json({ token, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('Error in /start:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

app.post('/update', (req, res) => {
    try {
        const { token, x, y } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }
        
        if (sessions[token]) {
            sessions[token] = { x: parseFloat(x) || 0, y: parseFloat(y) || 0, ts: Date.now() };
            console.log(`Updated ${token} with x: ${x}, y: ${y}`);
            res.json({ ok: true, timestamp: new Date().toISOString() });
        } else {
            console.log(`Invalid token attempted: ${token}`);
            res.status(400).json({ error: 'Invalid token' });
        }
    } catch (error) {
        console.error('Error in /update:', error);
        res.status(500).json({ error: 'Failed to update session' });
    }
});

app.get('/latest/:token', (req, res) => {
    try {
        const token = req.params.token;
        const session = sessions[token];
        
        if (session && Date.now() - session.ts < 30000) {
            res.json({ 
                x: session.x, 
                y: session.y, 
                timestamp: new Date(session.ts).toISOString() 
            });
        } else {
            res.status(404).json({ 
                error: 'Session expired or not found',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Error in /latest:', error);
        res.status(500).json({ error: 'Failed to get session data' });
    }
});

app.get('/sessions', (req, res) => {
    // Debug endpoint to see active sessions
    const now = Date.now();
    const activeSessions = Object.keys(sessions).map(token => ({
        token,
        data: sessions[token],
        age: Math.round((now - sessions[token].ts) / 1000) + 's'
    }));
    
    res.json({ 
        count: activeSessions.length, 
        sessions: activeSessions,
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Time: ${new Date().toISOString()}`);
});
