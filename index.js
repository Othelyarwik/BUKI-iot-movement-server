const express = require('express');
const cors = require('cors');
const app = express();

// CORS for PictoBlox compatibility
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
}));

// Additional headers for maximum speed
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Connection', 'keep-alive'); // Keep connections alive
    res.header('Keep-Alive', 'timeout=5, max=1000'); // Optimize connection reuse
    next();
});

app.use(express.json());
app.use(express.static('public'));

// Session storage with simple smoothing
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

// Create session and generate token
app.post('/start', (req, res) => {
    try {
        // Generate clear 8-character token (no confusing characters)
        const clearChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
        let token = '';
        for (let i = 0; i < 8; i++) {
            token += clearChars.charAt(Math.floor(Math.random() * clearChars.length));
        }

        // Create session with smoothing history
        sessions[token] = { 
            x: 0, 
            y: 0, 
            ts: Date.now(),
            history: [] // Simple smoothing history
        };

        res.json({ token, success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Update motion data with simple smoothing
app.post('/update', (req, res) => {
    try {
        const { token, x, y } = req.body;

        if (!token || !sessions[token]) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        const session = sessions[token];
        const newX = parseFloat(x) || 0;
        const newY = parseFloat(y) || 0;

        // Simple smoothing: average with previous values
        session.history.push({ x: newX, y: newY });
        if (session.history.length > 3) {
            session.history.shift(); // Keep only last 3 samples
        }

        // Calculate smooth average
        const avgX = session.history.reduce((sum, sample) => sum + sample.x, 0) / session.history.length;
        const avgY = session.history.reduce((sum, sample) => sum + sample.y, 0) / session.history.length;

        // Update session with smoothed values
        sessions[token] = {
            ...session,
            x: avgX,
            y: avgY,
            ts: Date.now()
        };

        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: 'Update failed' });
    }
});

// Get X movement for PictoBlox (-5 to +5)
app.get('/x/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        if (!session || Date.now() - session.ts > 60000) {
            return res.status(200).end('0');
        }

        // 1/3 more sensitive and faster: -4 to +4
        const movement = Math.max(-4, Math.min(4, Math.round(session.x * 1.0)));
        res.status(200).end(movement.toString());
    } catch (error) {
        res.status(200).end('0');
    }
});

// Get Y movement for PictoBlox (-5 to +5)
app.get('/y/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        if (!session || Date.now() - session.ts > 60000) {
            return res.status(200).end('0');
        }

        // 1/3 more sensitive and faster: -4 to +4
        const movement = Math.max(-4, Math.min(4, Math.round(session.y * 1.0)));
        res.status(200).end(movement.toString());
    } catch (error) {
        res.status(200).end('0');
    }
});

// Simple endpoint for PictoBlox (returns "X05Y05" format) with smoothing
app.get('/simple/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        if (!session || Date.now() - session.ts > 60000) {
            return         res.status(200).end('X05Y05'); // Center position
        }

        // Range validation with smoothed values
        let validX = session.x;
        let validY = session.y;
        
        if (Math.abs(validX) > 12 || Math.abs(validY) > 12) {
            validX = 0;
            validY = 0;
        }

        // Smoother mapping to 1-9 scale
        // Revert to center=5, but keep enhanced smoothing
        const mapToScale = (velocity) => {
            const clamped = Math.max(-10, Math.min(10, velocity));
            const normalized = clamped / 10;
            const curved = Math.sign(normalized) * Math.pow(Math.abs(normalized), 0.5); // More responsive
            const scaled = Math.round(((curved + 1) / 2) * 8) + 1;
            return Math.max(1, Math.min(9, scaled));
        };

        const xScaled = mapToScale(validX);
        const yScaled = mapToScale(validY);

        const result = `X${String(xScaled).padStart(2, '0')}Y${String(yScaled).padStart(2, '0')}`;
        
        res.status(200).end(result);
        
    } catch (error) {
        console.error('❌ Error in simple endpoint:', error);
        res.status(200).end('X07Y07');
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
