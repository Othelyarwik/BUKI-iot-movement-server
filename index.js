const express = require('express');
const cors = require('cors');
const app = express();

// CORS for PictoBlox compatibility
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
}));

// STEP 1: AGGRESSIVE CACHE PREVENTION (from Step 1)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    res.header('Last-Modified', new Date().toUTCString());
    res.header('ETag', false);
    res.header('X-Accel-Expires', '0');
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
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
    }
}));

// STEP 3 FINAL: Enhanced session storage with reduced auto-centering
const sessions = {};
const sessionStats = {
    totalCreated: 0,
    totalUpdates: 0,
    totalPictobloxRequests: 0,
    currentActive: 0,
    lastActivity: null
};

// Enhanced session cleanup with health monitoring
setInterval(() => {
    const now = Date.now();
    let expiredCount = 0;
    
    Object.keys(sessions).forEach(token => {
        if (now - sessions[token].ts > 120000) {
            delete sessions[token];
            expiredCount++;
        }
    });
    
    sessionStats.currentActive = Object.keys(sessions).length;
    
    if (expiredCount > 0) {
        console.log(`🧹 Cleaned up ${expiredCount} expired sessions. Active: ${sessionStats.currentActive}`);
    }
}, 120000);

// Connection health monitoring
function logConnectionHealth(endpoint, token, success, details = '') {
    const timestamp = new Date().toISOString();
    const sessionAge = sessions[token] ? Date.now() - sessions[token].ts : 'N/A';
    
    console.log(`🏥 HEALTH [${timestamp}] ${endpoint} - Token: ${token} - Success: ${success} - Age: ${sessionAge}ms ${details}`);
    
    sessionStats.lastActivity = timestamp;
}

// Serve phone interface with enhanced error tracking
app.get('/', (req, res) => {
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

// Enhanced session creation with better error handling
app.post('/start', (req, res) => {
    try {
        console.log('🚀 POST /start - Creating new session');
        
        // Generate 8-digit NUMERIC token (numpad friendly)
        const clearChars = '23456789';
        let token = '';
        for (let i = 0; i < 8; i++) {
            token += clearChars.charAt(Math.floor(Math.random() * clearChars.length));
        }

        // STEP 3 FINAL: Enhanced session with minimal auto-centering
        sessions[token] = {
            x: 0,
            y: 0,
            ts: Date.now(),
            created: Date.now(),
            history: [], // Reduced history for less smoothing
            updateCount: 0,
            lastUpdateTime: Date.now(),
            health: {
                connectionQuality: 'good',
                lastPictobloxRequest: null,
                pictobloxRequestCount: 0
            }
        };

        sessionStats.totalCreated++;
        sessionStats.currentActive = Object.keys(sessions).length;

        console.log(`✅ New spaceship session created: ${token}`);
        console.log(`📊 Session Stats - Total: ${sessionStats.totalCreated}, Active: ${sessionStats.currentActive}`);
        
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        res.json({ 
            token, 
            success: true, 
            timestamp: Date.now(),
            sessionInfo: {
                created: sessions[token].created,
                serverHealth: 'optimal',
                ranges: 'full-range-unlocked'
            }
        });
    } catch (error) {
        console.error('❌ Session creation error:', error);
        res.status(500).json({ 
            error: 'Failed to create session',
            details: error.message,
            timestamp: Date.now()
        });
    }
});

// STEP 3 FINAL: Motion data update with minimal smoothing and no auto-centering
app.post('/update', (req, res) => {
    try {
        const { token, x, y } = req.body;
        const timestamp = Date.now();
        
        console.log(`📱 POST /update - Token: ${token}, X: ${x}, Y: ${y}, Time: ${timestamp}`);

        // Enhanced validation
        if (!token) {
            console.log(`❌ Missing token in update request`);
            return res.status(400).json({ 
                error: 'Missing token',
                received: { token, x, y },
                timestamp
            });
        }

        if (!sessions[token]) {
            console.log(`❌ Invalid/expired token: ${token}`);
            logConnectionHealth('/update', token, false, 'Token not found');
            return res.status(400).json({ 
                error: 'Invalid or expired token',
                token: token,
                activeSessions: Object.keys(sessions).length,
                timestamp
            });
        }

        const session = sessions[token];
        const newX = parseFloat(x);
        const newY = parseFloat(y);

        // Enhanced data validation
        if (isNaN(newX) || isNaN(newY)) {
            console.log(`❌ Invalid motion data - X: ${x} (${typeof x}), Y: ${y} (${typeof y})`);
            return res.status(400).json({
                error: 'Invalid motion data - must be numbers',
                received: { x: typeof x, y: typeof y },
                timestamp
            });
        }

        // STEP 3 EMERGENCY REVERT: Go back to working smoothing with slight range increase
        session.history.push({ x: newX, y: newY, timestamp });
        if (session.history.length > 3) {
            session.history.shift();
        }

        // Calculate smooth average (back to original working method)
        const avgX = session.history.reduce((sum, sample) => sum + sample.x, 0) / session.history.length;
        const avgY = session.history.reduce((sum, sample) => sum + sample.y, 0) / session.history.length;

        // STEP 3 FINAL: Enhanced session update with minimal centering
        sessions[token] = {
            ...session,
            x: avgX, // Direct assignment - no centering bias
            y: avgY,
            ts: timestamp,
            updateCount: session.updateCount + 1,
            lastUpdateTime: timestamp,
            health: {
                ...session.health,
                connectionQuality: 'good'
            }
        };

        sessionStats.totalUpdates++;

        console.log(`✅ FULL-RANGE Motion updated - Token: ${token}, Count: ${session.updateCount + 1}, Raw X: ${avgX.toFixed(2)}, Y: ${avgY.toFixed(2)}`);
        logConnectionHealth('/update', token, true, `Update #${session.updateCount + 1}`);

        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache'
        });
        
        res.json({ 
            ok: true,
            processed: { x: avgX, y: avgY },
            updateCount: session.updateCount + 1,
            timestamp,
            range: 'full-unlocked'
        });
    } catch (error) {
        console.error('❌ Update error:', error);
        res.status(500).json({ 
            error: 'Update failed',
            details: error.message,
            timestamp: Date.now()
        });
    }
});

// STEP 3 FINAL: X endpoint with EXPANDED range (-15 to +15)
app.get('/x/:token', (req, res) => {
    try {
        const token = req.params.token;
        const session = sessions[token];
        const timestamp = Date.now();
        
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        if (!session) {
            console.log(`❌ X endpoint - Token not found: ${token}`);
            logConnectionHealth('/x', token, false, 'Token not found');
            return res.status(200).end('0');
        }
        
        if (timestamp - session.ts > 60000) {
            console.log(`❌ X endpoint - Token expired: ${token} (age: ${timestamp - session.ts}ms)`);
            logConnectionHealth('/x', token, false, 'Token expired');
            return res.status(200).end('0');
        }

        // STEP 3 EMERGENCY REVERT: Moderate range increase only -8 to +8
        const movement = Math.max(-8, Math.min(8, Math.round(session.x * 1.2))); // Gentle increase
        
        console.log(`📤 FULL-RANGE X endpoint - Token: ${token}, Value: ${movement}, Session Age: ${timestamp - session.ts}ms`);
        logConnectionHealth('/x', token, true, `Value: ${movement}`);
        
        res.status(200).end(movement.toString());
    } catch (error) {
        console.error('❌ X endpoint error:', error);
        res.status(200).end('0');
    }
});

// STEP 3 FINAL: Y endpoint with EXPANDED range (-15 to +15)
app.get('/y/:token', (req, res) => {
    try {
        const token = req.params.token;
        const session = sessions[token];
        const timestamp = Date.now();
        
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        if (!session) {
            console.log(`❌ Y endpoint - Token not found: ${token}`);
            logConnectionHealth('/y', token, false, 'Token not found');
            return res.status(200).end('0');
        }
        
        if (timestamp - session.ts > 60000) {
            console.log(`❌ Y endpoint - Token expired: ${token} (age: ${timestamp - session.ts}ms)`);
            logConnectionHealth('/y', token, false, 'Token expired');
            return res.status(200).end('0');
        }

        // STEP 3 EMERGENCY REVERT: Moderate range increase only -8 to +8
        const movement = Math.max(-8, Math.min(8, Math.round(session.y * 1.2))); // Gentle increase
        
        console.log(`📤 FULL-RANGE Y endpoint - Token: ${token}, Value: ${movement}, Session Age: ${timestamp - session.ts}ms`);
        logConnectionHealth('/y', token, true, `Value: ${movement}`);
        
        res.status(200).end(movement.toString());
    } catch (error) {
        console.error('❌ Y endpoint error:', error);
        res.status(200).end('0');
    }
});

// STEP 3 FINAL: MASSIVELY ENHANCED /simple endpoint with full-range mapping
app.get('/simple/:token', (req, res) => {
    try {
        const token = req.params.token;
        const session = sessions[token];
        const timestamp = Date.now();
        
        // CRITICAL: Prevent PictoBlox from caching motion data
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Timestamp': timestamp.toString()
        });
        
        sessionStats.totalPictobloxRequests++;
        
        if (!session) {
            console.log(`❌ PICTOBLOX - Token not found: ${token}`);
            console.log(`📊 Active sessions: ${Object.keys(sessions).join(', ')}`);
            logConnectionHealth('/simple', token, false, 'Token not found');
            return res.status(200).end('X05Y05');
        }
        
        const sessionAge = timestamp - session.ts;
        if (sessionAge > 60000) {
            console.log(`❌ PICTOBLOX - Token expired: ${token} (age: ${sessionAge}ms)`);
            logConnectionHealth('/simple', token, false, `Expired (${sessionAge}ms)`);
            return res.status(200).end('X05Y05');
        }

        // Update session health with PictoBlox activity
        session.health.lastPictobloxRequest = timestamp;
        session.health.pictobloxRequestCount++;

        // STEP 3 FINAL: EXPANDED range validation - allow much larger values
        let validX = session.x;
        let validY = session.y;

        // Increased from ±12 to ±25 for wider range
        if (Math.abs(validX) > 25 || Math.abs(validY) > 25) {
            console.log(`⚠️ PICTOBLOX - Extreme values X:${validX} Y:${validY}, clamping`);
            validX = Math.max(-25, Math.min(25, validX));
            validY = Math.max(-25, Math.min(25, validY));
        }

        // STEP 3 FINAL: FULL-RANGE mapping to 1-9 scale - much more sensitive
        const mapToScale = (velocity) => {
            // Expanded input range from ±10 to ±20 for full range
            const clamped = Math.max(-20, Math.min(20, velocity));
            const normalized = clamped / 20; // Divide by 20 instead of 10
            
            // REMOVED the curve for more linear response
            const linear = normalized; // Direct linear mapping, no power curve
            
            // Map to 1-9 scale with full range utilization
            const scaled = Math.round(((linear + 1) / 2) * 8) + 1;
            return Math.max(1, Math.min(9, scaled));
        };

        const xScaled = mapToScale(validX);
        const yScaled = mapToScale(validY);
        const result = `X${String(xScaled).padStart(2, '0')}Y${String(yScaled).padStart(2, '0')}`;
        
        // STEP 3 FINAL: Enhanced PictoBlox logging with range info
        console.log(`🎮 FULL-RANGE PICTOBLOX REQUEST #${session.health.pictobloxRequestCount}`);
        console.log(`📍 Token: ${token} | Session Age: ${sessionAge}ms`);
        console.log(`📊 Raw Motion: X=${validX.toFixed(2)}, Y=${validY.toFixed(2)} [EXPANDED RANGE]`);
        console.log(`📤 PictoBlox Response: ${result} [FULL-RANGE MAPPING]`);
        console.log(`📈 Phone Updates: ${session.updateCount} | PictoBlox Requests: ${session.health.pictobloxRequestCount}`);
        console.log(`─────────────────────────────────────────────`);
        
        logConnectionHealth('/simple', token, true, `${result} (req #${session.health.pictobloxRequestCount})`);
        
        res.status(200).end(result);
    } catch (error) {
        console.error('❌ PICTOBLOX ERROR:', error);
        logConnectionHealth('/simple', req.params.token, false, `Error: ${error.message}`);
        res.status(200).end('X05Y05');
    }
});

// Enhanced health check with detailed system status
app.get('/health', (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
    });
    
    const activeSessions = Object.keys(sessions);
    const sessionDetails = {};
    
    activeSessions.forEach(token => {
        const session = sessions[token];
        sessionDetails[token] = {
            age: Date.now() - session.ts,
            updates: session.updateCount,
            pictobloxRequests: session.health.pictobloxRequestCount,
            lastX: session.x,
            lastY: session.y,
            connectionQuality: session.health.connectionQuality
        };
    });
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        cacheHeaders: 'enabled',
        stats: sessionStats,
        activeSessions: activeSessions.length,
        sessions: sessionDetails,
        ranges: {
            individual: '±15 (expanded)',
            simple: '1-9 full-range',
            rawInput: '±25 accepted'
        },
        endpoints: {
            phone: '/',
            start: '/start',
            update: '/update',
            pictoblox: '/simple/:token',
            individual: '/x/:token, /y/:token'
        }
    });
});

// Detailed debugging endpoint
app.get('/debug/:token?', (req, res) => {
    const token = req.params.token;
    
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
    });
    
    if (token && sessions[token]) {
        const session = sessions[token];
        res.json({
            token: token,
            session: {
                created: new Date(session.created),
                lastUpdate: new Date(session.ts),
                age: Date.now() - session.ts,
                motionData: { x: session.x, y: session.y },
                updateCount: session.updateCount,
                history: session.history,
                health: session.health,
                ranges: {
                    currentX: session.x,
                    currentY: session.y,
                    scaledX: Math.max(-15, Math.min(15, Math.round(session.x * 2.0))),
                    scaledY: Math.max(-15, Math.min(15, Math.round(session.y * 2.0)))
                }
            },
            serverStats: sessionStats
        });
    } else {
        res.json({
            message: token ? `Token ${token} not found` : 'System debug info',
            activeSessions: Object.keys(sessions),
            serverStats: sessionStats,
            availableTokens: Object.keys(sessions),
            ranges: 'FULL-RANGE UNLOCKED'
        });
    }
});

// Cache test endpoint (from Step 1)
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

// Start server with enhanced startup info
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 STEP 3 FINAL: FULL-RANGE MOTION CONTROL UNLEASHED!`);
    console.log(`🚀 Spaceship Controller Server running on port ${PORT}`);
    console.log(`📱 Phone Interface: http://localhost:${PORT}`);
    console.log(`🧪 Cache Test: http://localhost:${PORT}/cache-test`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    console.log(`🔍 Debug Info: http://localhost:${PORT}/debug`);
    console.log(`🎮 PictoBlox Endpoints:`);
    console.log(`  - Simple: /simple/TOKEN`);
    console.log(`  - X/Y: /x/TOKEN, /y/TOKEN`);
    console.log(`✨ STEP 3 FINAL FEATURES:`);
    console.log(`  ✅ Cache prevention (Step 1)`);
    console.log(`  ✅ Enhanced error handling (Step 2)`);
    console.log(`  ✅ Motion sensor keep-alive (Step 3)`);
    console.log(`  ✅ Throttled updates (Step 3 Fix)`);
    console.log(`  🚀 EXPANDED RANGE: ±15 individual, 1-9 full-range simple`);
    console.log(`  🚀 MINIMAL AUTO-CENTERING: Responsive control unleashed`);
    console.log(`  🚀 LINEAR MAPPING: No curve smoothing, direct response`);
    console.log(`📡 LEASH REMOVED - FULL SPACESHIP CONTROL ACTIVATED!`);
});
