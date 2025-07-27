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

// Session storage - REMOVED server-side smoothing for more responsiveness
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

        // FIXED: Removed smoothing history - direct values for responsiveness
        sessions[token] = {
            x: 0,
            y: 0,
            ts: Date.now()
        };

        res.json({ token, success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// FIXED: Update motion data WITHOUT smoothing - direct values
app.post('/update', (req, res) => {
    try {
        const { token, x, y } = req.body;

        if (!token || !sessions[token]) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        const newX = parseFloat(x) || 0;
        const newY = parseFloat(y) || 0;

        // FIXED: Direct assignment - no smoothing on server side
        sessions[token] = {
            x: newX,
            y: newY,
            ts: Date.now()
        };

        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: 'Update failed' });
    }
});

// Get X movement for PictoBlox (-5 to +5) - FIXED: Increased sensitivity
app.get('/x/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        if (!session || Date.now() - session.ts > 180000) { // FIXED: 180 seconds timeout
            return res.status(200).end('0');
        }

        // FIXED: More sensitive and wider range: -5 to +5
        const movement = Math.max(-5, Math.min(5, Math.round(session.x * 1.2)));
        res.status(200).end(movement.toString());
    } catch (error) {
        res.status(200).end('0');
    }
});

// Get Y movement for PictoBlox (-5 to +5) - FIXED: Increased sensitivity
app.get('/y/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        if (!session || Date.now() - session.ts > 180000) { // FIXED: 180 seconds timeout
            return res.status(200).end('0');
        }

        // FIXED: More sensitive and wider range: -5 to +5
        const movement = Math.max(-5, Math.min(5, Math.round(session.y * 1.2)));
        res.status(200).end(movement.toString());
    } catch (error) {
        res.status(200).end('0');
    }
});

// FIXED: Simple endpoint without random variations
app.get('/simple/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        if (!session || Date.now() - session.ts > 180000) { // FIXED: 180 seconds timeout
            return res.status(200).end('X05Y05'); // Center position
        }

        // Range validation
        let validX = session.x;
        let validY = session.y;
        
        if (Math.abs(validX) > 15 || Math.abs(validY) > 15) {
            console.log(`⚠️ Extreme values detected X:${validX} Y:${validY}, resetting to center`);
            validX = 0;
            validY = 0;
        }

        // FIXED: More responsive mapping to 1-9 scale
        const mapToScale = (velocity) => {
            const clamped = Math.max(-8, Math.min(8, velocity));
            const normalized = clamped / 8; // Scale to -1 to +1
            const scaled = Math.round(((normalized + 1) / 2) * 8) + 1;
            return Math.max(1, Math.min(9, scaled));
        };

        const xScaled = mapToScale(validX);
        const yScaled = mapToScale(validY);

        const result = `X${String(xScaled).padStart(2, '0')}Y${String(yScaled).padStart(2, '0')}`;
        
        console.log(`📤 Sending: ${result} (from x=${validX.toFixed(1)}, y=${validY.toFixed(1)})`);
        res.status(200).end(result);
        
    } catch (error) {
        console.error('❌ Error in simple endpoint:', error);
        res.status(200).end('X05Y05');
    }
});

// FIXED: Batching endpoint WITHOUT random variations for consistent movement
app.get('/batch/:token/:count', (req, res) => {
    try {
        const session = sessions[req.params.token];
        const count = Math.min(parseInt(req.params.count) || 3, 10); // Max 10 positions

        if (!session || Date.now() - session.ts > 180000) { // FIXED: 180 seconds timeout
            // Return center positions for bad token
            const centerBatch = 'X05Y05,'.repeat(count).slice(0, -1);
            return res.status(200).end(centerBatch);
        }

        // FIXED: Generate consistent positions WITHOUT random variations
        const positions = [];
        const baseX = session.x;
        const baseY = session.y;

        for (let i = 0; i < count; i++) {
            // FIXED: No random variations - use exact same values for consistency
            const interpolatedX = baseX;
            const interpolatedY = baseY;

            // Use same mapping as simple endpoint
            const mapToScale = (velocity) => {
                const clamped = Math.max(-8, Math.min(8, velocity));
                const normalized = clamped / 8;
                const scaled = Math.round(((normalized + 1) / 2) * 8) + 1;
                return Math.max(1, Math.min(9, scaled));
            };

            const xScaled = mapToScale(interpolatedX);
            const yScaled = mapToScale(interpolatedY);

            positions.push(`X${String(xScaled).padStart(2, '0')}Y${String(yScaled).padStart(2, '0')}`);
        }

        res.status(200).end(positions.join(','));
    } catch (error) {
        console.error('❌ Error in batch endpoint:', error);
        const centerBatch = 'X05Y05,'.repeat(3).slice(0, -1);
        res.status(200).end(centerBatch);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Phone Interface: http://localhost:${PORT}`);
    console.log(`🎮 PictoBlox Endpoints:`);
    console.log(`  - Individual: /x/TOKEN and /y/TOKEN`);
    console.log(`  - Simple: /simple/TOKEN`);
    console.log(`  - Batch: /batch/TOKEN/COUNT`);
    console.log(`✨ FIXED: No smoothing, no random variations, 180s timeout!`);
});
