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

// DIAGNOSTIC: Enhanced session storage with health monitoring
const sessions = {};

// DIAGNOSTIC: Track session activity for debugging
const sessionStats = {
    totalUpdates: 0,
    lastUpdateTime: 0,
    stuckSessions: new Set()
};

// Clean expired sessions and detect stuck ones
setInterval(() => {
    const now = Date.now();
    Object.keys(sessions).forEach(token => {
        const session = sessions[token];
        const timeSinceUpdate = now - session.ts;
        
        // DIAGNOSTIC: Detect sessions that haven't updated in 30 seconds
        if (timeSinceUpdate > 30000 && timeSinceUpdate < 120000) {
            if (!sessionStats.stuckSessions.has(token)) {
                console.warn(`⚠️ Session ${token} appears stuck - no updates for ${Math.round(timeSinceUpdate/1000)}s`);
                sessionStats.stuckSessions.add(token);
            }
        }
        
        // Clean expired sessions
        if (timeSinceUpdate > 120000) {
            sessionStats.stuckSessions.delete(token);
            delete sessions[token];
            console.log(`🗑️ Cleaned expired session ${token}`);
        }
    });
}, 30000); // Check every 30 seconds

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
        sessions[token] = {
            x: 0,
            y: 0,
            ts: Date.now()
        };

        console.log(`🔗 New session created: ${token}`);
        res.json({ token, success: true });
    } catch (error) {
        console.error('❌ Failed to create session:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// DIAGNOSTIC: Enhanced update with comprehensive logging
app.post('/update', (req, res) => {
    try {
        const { token, x, y } = req.body;

        if (!token || !sessions[token]) {
            console.warn(`❌ Invalid token in update: ${token}`);
            return res.status(400).json({ error: 'Invalid token' });
        }

        const newX = parseFloat(x) || 0;
        const newY = parseFloat(y) || 0;

        // DIAGNOSTIC: Detect if values are changing
        const oldSession = sessions[token];
        const valueChanged = Math.abs(newX - oldSession.x) > 0.1 || Math.abs(newY - oldSession.y) > 0.1;
        
        if (!valueChanged && sessionStats.totalUpdates % 20 === 0) {
            console.log(`📊 Session ${token}: Values unchanged (X=${newX.toFixed(1)}, Y=${newY.toFixed(1)})`);
        }

        // Update session with new values
        sessions[token] = {
            x: newX,
            y: newY,
            ts: Date.now()
        };

        sessionStats.totalUpdates++;
        sessionStats.lastUpdateTime = Date.now();
        sessionStats.stuckSessions.delete(token); // Remove from stuck list if updating

        // DIAGNOSTIC: Log significant value changes
        if (valueChanged) {
            console.log(`🎮 Motion update ${token}: X=${newX.toFixed(1)} Y=${newY.toFixed(1)}`);
        }

        res.json({ ok: true });
    } catch (error) {
        console.error('❌ Update error:', error);
        res.status(500).json({ error: 'Update failed' });
    }
});

// Get X movement for PictoBlox (-6 to +6) - FIXED: Increased sensitivity
app.get('/x/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        if (!session || Date.now() - session.ts > 180000) { // FIXED: 180 seconds timeout
            return res.status(200).end('0');
        }

        // FIXED: More sensitive and wider range: -6 to +6
        const movement = Math.max(-6, Math.min(6, Math.round(session.x * 1.5))); // INCREASED sensitivity
        res.status(200).end(movement.toString());
    } catch (error) {
        res.status(200).end('0');
    }
});

// Get Y movement for PictoBlox (-6 to +6) - FIXED: Increased sensitivity
app.get('/y/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        if (!session || Date.now() - session.ts > 180000) { // FIXED: 180 seconds timeout
            return res.status(200).end('0');
        }

        // FIXED: More sensitive and wider range: -6 to +6
        const movement = Math.max(-6, Math.min(6, Math.round(session.y * 1.5))); // INCREASED sensitivity
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

        // FIXED: More aggressive mapping to 1-9 scale
        const mapToScale = (velocity) => {
            const clamped = Math.max(-10, Math.min(10, velocity)); // INCREASED range to ±10
            const normalized = clamped / 10; // Scale to -1 to +1
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

// DIAGNOSTIC: Enhanced batching endpoint with detailed logging
app.get('/batch/:token/:count', (req, res) => {
    try {
        const session = sessions[req.params.token];
        const count = Math.min(parseInt(req.params.count) || 3, 10);
        const token = req.params.token;

        if (!session || Date.now() - session.ts > 180000) {
            console.warn(`❌ Batch request for invalid/expired token: ${token}`);
            const centerBatch = 'X05Y05,'.repeat(count).slice(0, -1);
            return res.status(200).end(centerBatch);
        }

        // Generate consistent positions WITHOUT random variations
        const positions = [];
        const baseX = session.x;
        const baseY = session.y;

        // DIAGNOSTIC: Log the source values being used
        const timeSinceUpdate = Date.now() - session.ts;
        console.log(`📦 Batch request ${token}: Using X=${baseX.toFixed(2)} Y=${baseY.toFixed(2)} (${timeSinceUpdate}ms old)`);

        for (let i = 0; i < count; i++) {
            const interpolatedX = baseX;
            const interpolatedY = baseY;

            const mapToScale = (velocity) => {
                const clamped = Math.max(-10, Math.min(10, velocity)); // INCREASED range to ±10
                const normalized = clamped / 10;
                const scaled = Math.round(((normalized + 1) / 2) * 8) + 1;
                return Math.max(1, Math.min(9, scaled));
            };

            const xScaled = mapToScale(interpolatedX);
            const yScaled = mapToScale(interpolatedY);

            positions.push(`X${String(xScaled).padStart(2, '0')}Y${String(yScaled).padStart(2, '0')}`);
        }

        const result = positions.join(',');
        console.log(`📤 Batch response ${token}: ${result}`);
        res.status(200).end(result);
        
    } catch (error) {
        console.error('❌ Error in batch endpoint:', error);
        const centerBatch = 'X05Y05,'.repeat(3).slice(0, -1);
        res.status(200).end(centerBatch);
    }
});

// DIAGNOSTIC: Add a status endpoint to check server health
app.get('/status', (req, res) => {
    const activeSessions = Object.keys(sessions).length;
    const now = Date.now();
    const healthySessionsCount = Object.values(sessions).filter(session => 
        now - session.ts < 30000
    ).length;
    
    res.json({
        server: 'running',
        activeSessions,
        healthySessions: healthySessionsCount,
        stuckSessions: sessionStats.stuckSessions.size,
        totalUpdates: sessionStats.totalUpdates,
        lastUpdateAgo: sessionStats.lastUpdateTime ? now - sessionStats.lastUpdateTime : null,
        uptime: process.uptime()
    });
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
    console.log(`  - Status: /status`);
    console.log(`✨ FIXED: No smoothing, no random variations, 180s timeout, increased sensitivity!`);
});
