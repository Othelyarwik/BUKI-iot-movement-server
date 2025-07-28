const express = require('express');
const cors = require('cors');
const app = express();

// Enhanced CORS for PictoBlox compatibility with better error handling
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: false
}));

// Additional headers for PictoBlox with cache prevention
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    res.header('Surrogate-Control', 'no-store');
    next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

// Enhanced session storage with memory management
const sessions = {};
const MAX_SESSIONS = 100; // Prevent memory overflow
const SESSION_TIMEOUT = 180000; // 3 minutes instead of 2
const CLEANUP_INTERVAL = 60000; // Clean every minute

// Enhanced session cleanup with memory protection
const cleanupSessions = () => {
    const now = Date.now();
    const sessionKeys = Object.keys(sessions);
    let cleanedCount = 0;
    
    // Clean expired sessions
    sessionKeys.forEach(token => {
        if (now - sessions[token].ts > SESSION_TIMEOUT) {
            delete sessions[token];
            cleanedCount++;
        }
    });
    
    // Emergency cleanup if too many sessions
    if (sessionKeys.length - cleanedCount > MAX_SESSIONS) {
        const sortedSessions = sessionKeys
            .filter(token => sessions[token])
            .sort((a, b) => sessions[a].ts - sessions[b].ts);
        
        const toRemove = sortedSessions.slice(0, sortedSessions.length - MAX_SESSIONS);
        toRemove.forEach(token => {
            delete sessions[token];
            cleanedCount++;
        });
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 Cleaned ${cleanedCount} expired sessions. Active: ${Object.keys(sessions).length}`);
    }
};

// Start cleanup interval
setInterval(cleanupSessions, CLEANUP_INTERVAL);

// Serve phone interface
app.get('/', (req, res) => {
    try {
        res.sendFile(__dirname + '/public/index.html');
    } catch (error) {
        console.error('❌ Error serving index.html:', error);
        res.status(500).send('Server Error');
    }
});

// Enhanced session creation with collision detection
app.post('/start', (req, res) => {
    try {
        // Clean up first to ensure we have space
        cleanupSessions();
        
        // Check if we're at capacity
        if (Object.keys(sessions).length >= MAX_SESSIONS) {
            return res.status(503).json({ 
                error: 'Server at capacity. Please try again in a moment.',
                success: false 
            });
        }

        // Generate unique token with better collision detection
        const clearChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
        let token = '';
        let attempts = 0;
        const MAX_ATTEMPTS = 50;
        
        do {
            token = '';
            for (let i = 0; i < 8; i++) {
                token += clearChars.charAt(Math.floor(Math.random() * clearChars.length));
            }
            attempts++;
        } while (sessions[token] && attempts < MAX_ATTEMPTS);
        
        if (attempts >= MAX_ATTEMPTS) {
            return res.status(500).json({ 
                error: 'Unable to generate unique token. Please try again.',
                success: false 
            });
        }

        // Create session with enhanced data structure
        sessions[token] = { 
            x: 0, 
            y: 0, 
            ts: Date.now(),
            created: Date.now(),
            requestCount: 0,
            lastUpdate: Date.now()
        };

        console.log(`🎮 New session created: ${token} (Total active: ${Object.keys(sessions).length})`);
        res.json({ token, success: true });
        
    } catch (error) {
        console.error('❌ Error creating session:', error);
        res.status(500).json({ 
            error: 'Failed to create session', 
            success: false 
        });
    }
});

// Enhanced motion data update with validation
app.post('/update', (req, res) => {
    try {
        const { token, x, y } = req.body;

        // Enhanced validation
        if (!token || typeof token !== 'string' || token.length !== 8) {
            return res.status(400).json({ error: 'Invalid token format' });
        }

        if (!sessions[token]) {
            return res.status(404).json({ error: 'Session not found or expired' });
        }

        // Validate numeric inputs with proper bounds checking
        const numX = parseFloat(x);
        const numY = parseFloat(y);
        
        if (isNaN(numX) || isNaN(numY)) {
            return res.status(400).json({ error: 'Invalid motion data' });
        }
        
        // Clamp values to reasonable ranges to prevent overflow
        const clampedX = Math.max(-15, Math.min(15, numX));
        const clampedY = Math.max(-15, Math.min(15, numY));

        // Update session with rate limiting protection
        const session = sessions[token];
        const now = Date.now();
        
        // Rate limiting: max 50 updates per second per session
        if (now - session.lastUpdate < 20) {
            return res.json({ ok: true, throttled: true });
        }

        // Update session data
        sessions[token] = {
            ...session,
            x: clampedX,
            y: clampedY,
            ts: now,
            lastUpdate: now,
            requestCount: (session.requestCount || 0) + 1
        };

        res.json({ ok: true });
        
    } catch (error) {
        console.error('❌ Error updating session:', error);
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
            return res.status(200).end('X05Y05'); // Center position
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
        res.status(200).end(result);
        
    } catch (error) {
        console.error('❌ Error in simple endpoint:', error);
        res.status(200).end('X05Y05');
    }
});

// NEW: Batch endpoint for PictoBlox batching system
app.get('/batch/:token/:count', (req, res) => {
    try {
        const { token, count } = req.params;
        const batchSize = parseInt(count) || 5;
        
        // Validate session
        const session = sessions[token];
        if (!session || Date.now() - session.ts > 60000) {
            // Return center positions for all batch items
            const centerBatch = 'X05Y05'.repeat(batchSize);
            console.log(`📦 Batch for expired/invalid token: ${centerBatch}`);
            return res.status(200).end(centerBatch);
        }

        // Get current motion data
        let validX = session.x;
        let validY = session.y;
        
        // Range validation
        if (Math.abs(validX) > 12 || Math.abs(validY) > 12) {
            validX = 0;
            validY = 0;
        }

        // Map to 1-9 scale for PictoBlox
        const mapToScale = (velocity) => {
            const clamped = Math.max(-8, Math.min(8, velocity));
            const scaled = Math.round(((clamped + 8) / 16) * 8) + 1;
            return Math.max(1, Math.min(9, scaled));
        };

        const xScaled = mapToScale(validX);
        const yScaled = mapToScale(validY);

        // Create batch response - repeat current values for all positions
        let batchResponse = '';
        for (let i = 0; i < batchSize; i++) {
            // Add slight variation to make movement smoother
            const xVariation = Math.max(1, Math.min(9, xScaled + Math.floor(Math.random() * 3) - 1));
            const yVariation = Math.max(1, Math.min(9, yScaled + Math.floor(Math.random() * 3) - 1));
            
            batchResponse += `X${String(xVariation).padStart(2, '0')}Y${String(yVariation).padStart(2, '0')}`;
        }

        console.log(`📦 Batch response (${batchSize}): ${batchResponse} (base: x=${validX.toFixed(1)}, y=${validY.toFixed(1)})`);
        res.status(200).end(batchResponse);
        
    } catch (error) {
        console.error('❌ Error in batch endpoint:', error);
        // Return safe fallback
        const batchSize = parseInt(req.params.count) || 5;
        const centerBatch = 'X05Y05'.repeat(batchSize);
        res.status(200).end(centerBatch);
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
    console.log(`🚀 Motion Server Phase 4.5 running on port ${PORT}`);
    console.log(`📱 Phone interface: http://localhost:${PORT}/`);
    console.log(`🎮 Batch endpoint: /batch/:token/:count`);
    console.log(`💖 Health check: /health`);
});
