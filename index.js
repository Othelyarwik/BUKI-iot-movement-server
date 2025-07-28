const express = require('express');
const cors = require('cors');
const app = express();

// CORS for PictoBlox compatibility
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
}));

// Additional headers for PictoBlox
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
});

app.use(express.json());
app.use(express.static('public'));

// Session storage
const sessions = {};

// Clean expired sessions every 2 minutes
setInterval(() => {
    const now = Date.now();
    Object.keys(sessions).forEach(token => {
        if (now - sessions[token].ts > 120000) {
            delete sessions[token];
        }
    });
}, 120000);

// Serve phone interface
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Create session and generate numeric token
app.post('/start', (req, res) => {
    try {
        // Generate 8-digit numeric token (easy numpad entry)
        const clearChars = '23456789';
        let token = '';
        for (let i = 0; i < 8; i++) {
            token += clearChars.charAt(Math.floor(Math.random() * clearChars.length));
        }

        // Create session
        sessions[token] = { x: 0, y: 0, ts: Date.now() };

        console.log(`🎮 New session: ${token} (Total: ${Object.keys(sessions).length})`);
        res.json({ token, success: true });
    } catch (error) {
        console.error('❌ Session creation error:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Update motion data
app.post('/update', (req, res) => {
    try {
        const { token, x, y } = req.body;

        if (!token || !sessions[token]) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        // Update session with motion data
        sessions[token] = {
            x: parseFloat(x) || 0,
            y: parseFloat(y) || 0,
            ts: Date.now()
        };

        res.json({ ok: true });
    } catch (error) {
        console.error('❌ Update error:', error);
        res.status(500).json({ error: 'Update failed' });
    }
});

// Simple endpoint for PictoBlox (returns "X05Y05" format)
app.get('/simple/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        if (!session || Date.now() - session.ts > 60000) {
            return res.status(200).end('X05Y05'); // Center position
        }

        // Get current motion data
        let validX = session.x;
        let validY = session.y;
        
        // Range validation - if values are extreme, reset to center
        if (Math.abs(validX) > 12 || Math.abs(validY) > 12) {
            console.log(`⚠️ Extreme values X:${validX} Y:${validY}, centering`);
            validX = 0;
            validY = 0;
        }

        // Map -8 to +8 velocity to 1-9 scale
        const mapToScale = (velocity) => {
            const clamped = Math.max(-8, Math.min(8, velocity));
            const scaled = Math.round(((clamped + 8) / 16) * 8) + 1;
            return Math.max(1, Math.min(9, scaled));
        };

        const xScaled = mapToScale(validX);
        const yScaled = mapToScale(validY);

        // Return exactly 6 characters: X##Y##
        const result = `X${String(xScaled).padStart(2, '0')}Y${String(yScaled).padStart(2, '0')}`;
        
        console.log(`📤 ${req.params.token}: ${result} (raw: x=${validX.toFixed(1)}, y=${validY.toFixed(1)})`);
        res.status(200).end(result);
        
    } catch (error) {
        console.error('❌ Simple endpoint error:', error);
        res.status(200).end('X05Y05');
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        activeSessions: Object.keys(sessions).length,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Velocity-Based Motion Server running on port ${PORT}`);
    console.log(`📱 Phone interface: http://localhost:${PORT}/`);
    console.log(`🎮 PictoBlox endpoint: /simple/:token`);
    console.log(`💖 Health check: /health`);
});
