const express = require('express');
const cors = require('cors');
const app = express();

// CORS for PictoBlox compatibility
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
}));

// STEP 1: AGGRESSIVE CACHE PREVENTION FOR DEVELOPMENT
// This ensures ALL your code changes take effect immediately
app.use((req, res, next) => {
    // Prevent ALL caching - critical for development
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    res.header('Last-Modified', new Date().toUTCString());
    res.header('ETag', false);
    
    // Force immediate expiration
    res.header('X-Accel-Expires', '0');
    
    // Additional mobile browser cache prevention
    res.header('Vary', '*');
    
    console.log(`📡 ${req.method} ${req.path} - Cache headers applied`);
    next();
});

app.use(express.json());

// Serve static files with cache busting
app.use(express.static('public', {
    maxAge: 0,
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
        // Extra aggressive cache prevention for static files
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
    }
}));

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

// Serve phone interface with cache busting timestamp
app.get('/', (req, res) => {
    // Add timestamp to prevent caching
    const timestamp = Date.now();
    console.log(`🌐 Serving index.html with cache-bust: ${timestamp}`);
    
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Timestamp': timestamp.toString()
    });
    
    res.sendFile(__dirname + '/public/index.html');
});

// Create session and generate NUMERIC token
app.post('/start', (req, res) => {
    try {
        console.log('🚀 POST /start - Creating new session');
        
        // Generate 8-digit NUMERIC token (numpad friendly)
        const clearChars = '23456789'; // Only numbers, no 0 or 1
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

        console.log(`✅ New spaceship session created: ${token}`);
        
        // Prevent caching of API responses
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        res.json({ token, success: true, timestamp: Date.now() });
    } catch (error) {
        console.error('❌ Session creation error:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// Update motion data with simple smoothing
app.post('/update', (req, res) => {
    try {
        const { token, x, y } = req.body;
        console.log(`📱 POST /update - Token: ${token}, X: ${x}, Y: ${y}`);

        if (!token || !sessions[token]) {
            console.log(`❌ Invalid token: ${token}`);
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

        console.log(`✅ Motion updated - Smoothed X: ${avgX.toFixed(2)}, Y: ${avgY.toFixed(2)}`);

        // Prevent caching of motion data
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache'
        });
        
        res.json({ ok: true });
    } catch (error) {
        console.error('❌ Update error:', error);
        res.status(500).json({ error: 'Update failed' });
    }
});

// Get X movement for PictoBlox (-4 to +4) with cache prevention
app.get('/x/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        
        // Prevent caching of live data
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        if (!session || Date.now() - session.ts > 60000) {
            console.log(`❌ X endpoint - Token expired or not found: ${req.params.token}`);
            return res.status(200).end('0');
        }

        // 1/3 more sensitive and faster: -4 to +4
        const movement = Math.max(-4, Math.min(4, Math.round(session.x * 1.0)));
        console.log(`📤 X endpoint - Token: ${req.params.token}, Value: ${movement}`);
        res.status(200).end(movement.toString());
    } catch (error) {
        console.error('❌ X endpoint error:', error);
        res.status(200).end('0');
    }
});

// Get Y movement for PictoBlox (-4 to +4) with cache prevention
app.get('/y/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        
        // Prevent caching of live data
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        if (!session || Date.now() - session.ts > 60000) {
            console.log(`❌ Y endpoint - Token expired or not found: ${req.params.token}`);
            return res.status(200).end('0');
        }

        // 1/3 more sensitive and faster: -4 to +4
        const movement = Math.max(-4, Math.min(4, Math.round(session.y * 1.0)));
        console.log(`📤 Y endpoint - Token: ${req.params.token}, Value: ${movement}`);
        res.status(200).end(movement.toString());
    } catch (error) {
        console.error('❌ Y endpoint error:', error);
        res.status(200).end('0');
    }
});

// Simple endpoint for PictoBlox (returns "X05Y05" format) with aggressive cache prevention
app.get('/simple/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        
        // CRITICAL: Prevent PictoBlox from caching motion data
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Timestamp': Date.now().toString()
        });
        
        if (!session || Date.now() - session.ts > 60000) {
            console.log(`❌ Simple endpoint - Token expired/not found: ${req.params.token}`);
            return res.status(200).end('X05Y05'); // Center position
        }

        // Range validation with smoothed values
        let validX = session.x;
        let validY = session.y;

        if (Math.abs(validX) > 12 || Math.abs(validY) > 12) {
            console.log(`⚠️ Extreme values X:${validX} Y:${validY}, centering`);
            validX = 0;
            validY = 0;
        }

        // Smoother mapping to 1-9 scale
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
        
        // Enhanced debug logging for PictoBlox endpoint
        console.log(`📤 PICTOBLOX REQUEST - Token: ${req.params.token}`);
        console.log(`📤 Response: ${result} (raw: x=${validX.toFixed(1)}, y=${validY.toFixed(1)}) age: ${Date.now() - session.ts}ms`);
        
        res.status(200).end(result);
    } catch (error) {
        console.error('❌ Error in simple endpoint:', error);
        res.status(200).end('X05Y05');
    }
});

// Health check with cache prevention
app.get('/health', (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
    });
    
    res.json({
        status: 'healthy',
        activeSessions: Object.keys(sessions).length,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        cacheHeaders: 'enabled'
    });
});

// STEP 1 TEST ENDPOINT: Check if cache busting is working
app.get('/cache-test', (req, res) => {
    const timestamp = Date.now();
    
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    
    res.json({
        message: 'Cache test endpoint',
        timestamp: timestamp,
        randomValue: Math.random(),
        headers: 'no-cache applied'
    });
    
    console.log(`🧪 Cache test accessed - Timestamp: ${timestamp}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 STEP 1 IMPLEMENTATION: Cache-Busting Server`);
    console.log(`🚀 Spaceship Controller Server running on port ${PORT}`);
    console.log(`📱 Phone Interface: http://localhost:${PORT}`);
    console.log(`🧪 Cache Test: http://localhost:${PORT}/cache-test`);
    console.log(`🎮 PictoBlox Endpoints:`);
    console.log(`  - Simple: /simple/TOKEN`);
    console.log(`  - X/Y: /x/TOKEN, /y/TOKEN`);
    console.log(`✨ CACHE PREVENTION: All responses now include no-cache headers!`);
    console.log(`📡 Enhanced logging enabled for debugging`);
});
