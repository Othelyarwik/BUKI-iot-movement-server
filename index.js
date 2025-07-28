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

// Create session and generate token
app.post('/start', (req, res) => {
    try {
        // Generate clear 8-character token (no confusing characters)
        const clearChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
        let token = '';
        for (let i = 0; i < 8; i++) {
            token += clearChars.charAt(Math.floor(Math.random() * clearChars.length));
        }

        // Create session
        sessions[token] = { x: 0, y: 0, ts: Date.now() };

        res.json({ token, success: true });
    } catch (error) {
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

        // Update session
        sessions[token] = {
            x: parseFloat(x) || 0,
            y: parseFloat(y) || 0,
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

        const movement = Math.max(-5, Math.min(5, Math.round(session.x * 0.8)));
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

        const movement = Math.max(-5, Math.min(5, Math.round(session.y * 0.8)));
        res.status(200).end(movement.toString());
    } catch (error) {
        res.status(200).end('0');
    }
});

// Simple endpoint for PictoBlox (returns "X05Y05" format) with improved filtering
app.get('/simple/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        if (!session || Date.now() - session.ts > 60000) {
            // Send as plain text with explicit content type
            res.type('text/plain');
            return res.send('X05Y05'); // Center position
        }

        // FIXED: Prevent Y-axis sticking by adding range validation
        let validX = session.x;
        let validY = session.y;
        
        // Range validation - if values are extreme, reset to center
        if (Math.abs(validX) > 12 || Math.abs(validY) > 12) {
            console.log(`⚠️ Extreme values detected X:${validX} Y:${validY}, resetting to center`);
            validX = 0;
            validY = 0;
        }

        // IMPROVED: Map -8 to +8 velocity to 1-9 scale with better distribution
        const mapToScale = (velocity) => {
            // Clamp to safe range first
            const clamped = Math.max(-8, Math.min(8, velocity));
            // Map to 1-9 scale: -8 = 1, 0 = 5, +8 = 9
            const scaled = Math.round(((clamped + 8) / 16) * 8) + 1;
            return Math.max(1, Math.min(9, scaled));
        };

        const xScaled = mapToScale(validX);
        const yScaled = mapToScale(validY);

        // Always return exactly 6 characters
        const result = `X${String(xScaled).padStart(2, '0')}Y${String(yScaled).padStart(2, '0')}`;
        
        console.log(`📤 Sending: ${result} (from x=${validX.toFixed(1)}, y=${validY.toFixed(1)})`);
        
        // Send as plain text with explicit content type
        res.type('text/plain');
        res.send(result);
        
    } catch (error) {
        console.error('❌ Error in simple endpoint:', error);
        res.type('text/plain');
        res.send('X05Y05');
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
