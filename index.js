const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');

const app = express();

// Enhanced CORS configuration - specifically for PictoBlox compatibility
app.use(cors({
    origin: '*', // Allow all origins
    credentials: false, // Don't require credentials
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD', 'PUT', 'DELETE'],
    allowedHeaders: ['*'],
    exposedHeaders: ['*'],
    maxAge: 86400 // Cache preflight for 24 hours
}));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Max-Age', '86400');
    res.sendStatus(200);
});

// Add explicit CORS headers to all responses
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Expose-Headers', '*');
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Enhanced request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const userAgent = req.get('User-Agent') || 'unknown';
    console.log(`${timestamp} - ${req.method} ${req.path}`);
    console.log(`  User-Agent: ${userAgent}`);
    console.log(`  Origin: ${req.get('Origin') || 'none'}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log(`  Body: ${JSON.stringify(req.body)}`);
    }
    next();
});

const sessions = {};

// Cleanup expired sessions every 2 minutes (more frequent)
setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;
    Object.keys(sessions).forEach(token => {
        if (now - sessions[token].ts > 120000) { // 2 minutes instead of 5
            delete sessions[token];
            cleanedCount++;
        }
    });
    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired sessions`);
    }
}, 120000);

// Root endpoint - serve the HTML file
app.get('/', (req, res) => {
    console.log('Serving index.html');
    res.sendFile(__dirname + '/public/index.html');
});

// Health check endpoint
app.get('/health', (req, res) => {
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeSessions: Object.keys(sessions).length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
    };
    console.log('Health check requested:', healthData);
    res.json(healthData);
});

// Start a new session and generate token
app.post('/start', (req, res) => {
    try {
        const token = nanoid(8);
        sessions[token] = { 
            x: 0, 
            y: 0, 
            ts: Date.now(),
            created: new Date().toISOString(),
            requests: 0
        };
        console.log(`✅ Created new session with token: ${token}`);
        
        const response = {
            token,
            timestamp: new Date().toISOString(),
            expiresIn: '30 seconds'
        };
        
        res.json(response);
    } catch (error) {
        console.error('❌ Error in /start:', error);
        res.status(500).json({ 
            error: 'Failed to create session',
            timestamp: new Date().toISOString()
        });
    }
});

// Update motion data for a session
app.post('/update', (req, res) => {
    try {
        const { token, x, y } = req.body;
        
        if (!token) {
            console.log('❌ Update request missing token');
            return res.status(400).json({ 
                error: 'Token is required',
                timestamp: new Date().toISOString()
            });
        }
        
        if (sessions[token]) {
            sessions[token] = { 
                ...sessions[token],
                x: parseFloat(x) || 0, 
                y: parseFloat(y) || 0, 
                ts: Date.now(),
                lastUpdate: new Date().toISOString()
            };
            console.log(`📱 Updated ${token} with x: ${x}, y: ${y}`);
            res.json({ 
                ok: true, 
                timestamp: new Date().toISOString(),
                received: { x: parseFloat(x) || 0, y: parseFloat(y) || 0 }
            });
        } else {
            console.log(`❌ Invalid token attempted: ${token}`);
            res.status(400).json({ 
                error: 'Invalid or expired token',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('❌ Error in /update:', error);
        res.status(500).json({ 
            error: 'Failed to update session',
            timestamp: new Date().toISOString()
        });
    }
});

// Get latest motion data - the endpoint PictoBlox uses
app.get('/latest/:token', (req, res) => {
    try {
        const token = req.params.token;
        const session = sessions[token];
        
        console.log(`🔍 Request for token: ${token}`);
        
        if (!session) {
            console.log(`❌ Session not found: ${token}`);
            return res.status(404).json({ 
                error: 'Session not found',
                token: token,
                timestamp: new Date().toISOString()
            });
        }
        
        const age = Date.now() - session.ts;
        console.log(`📊 Session age: ${Math.round(age/1000)}s`);
        
        if (age < 60000) { // Extended to 60 seconds for better compatibility
            // Increment request counter
            session.requests = (session.requests || 0) + 1;
            
            // Convert raw sensor values to 1-9 scale
            // X and Y typically range from -10 to +10, we'll map this to 1-9
            const mapToScale = (value) => {
                // Clamp value between -10 and +10
                const clamped = Math.max(-10, Math.min(10, value));
                // Map -10 to +10 range to 1-9 range
                // -10 = 1, 0 = 5, +10 = 9
                const scaled = Math.round(((clamped + 10) / 20) * 8) + 1;
                return Math.max(1, Math.min(9, scaled));
            };
            
            const xScaled = mapToScale(session.x);
            const yScaled = mapToScale(session.y);
            
            // Create a simple string format: "X5Y7" where X=5, Y=7
            const simpleFormat = `X${xScaled}Y${yScaled}`;
            
            const responseData = {
                simple: simpleFormat,
                x: session.x,
                y: session.y,
                xScaled: xScaled,
                yScaled: yScaled,
                timestamp: new Date(session.ts).toISOString(),
                age: Math.round(age/1000),
                requests: session.requests
            };
            
            console.log(`✅ Returning data for ${token}:`, responseData);
            res.json(responseData);
        } else {
            console.log(`⏰ Session expired: ${token} (age: ${Math.round(age/1000)}s)`);
            // Clean up expired session
            delete sessions[token];
            res.status(404).json({ 
                error: 'Session expired',
                token: token,
                age: Math.round(age/1000),
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('❌ Error in /latest:', error);
        res.status(500).json({ 
            error: 'Failed to get session data',
            timestamp: new Date().toISOString()
        });
    }
});

// Debug endpoint to see all active sessions
app.get('/sessions', (req, res) => {
    try {
        const now = Date.now();
        const activeSessions = Object.keys(sessions).map(token => ({
            token,
            data: sessions[token],
            age: Math.round((now - sessions[token].ts) / 1000) + 's',
            requests: sessions[token].requests || 0
        }));
        
        const response = {
            count: activeSessions.length,
            sessions: activeSessions,
            timestamp: new Date().toISOString(),
            serverUptime: Math.round(process.uptime()) + 's'
        };
        
        console.log('📋 Sessions debug requested:', response);
        res.json(response);
    } catch (error) {
        console.error('❌ Error in /sessions:', error);
        res.status(500).json({ 
            error: 'Failed to get sessions data',
            timestamp: new Date().toISOString()
        });
    }
});

// Simple endpoint that returns movement values for PictoBlox
app.get('/simple/:token', (req, res) => {
    try {
        const token = req.params.token;
        const session = sessions[token];
        
        // Set headers for speed and plain text (no JSON)
        res.set({
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Content-Type': 'text/plain; charset=utf-8'
        });
        
        if (!session) {
            return res.send('+00+00');  // Send plain text, no quotes
        }
        
        const age = Date.now() - session.ts;
        if (age >= 60000) {
            delete sessions[token];
            return res.send('+00+00');  // Send plain text, no quotes
        }
        
        // Convert velocity to movement values suitable for PictoBlox
        const formatNumber = (num) => {
            // Much smaller scaling for smoother control
            const scaled = Math.max(-5, Math.min(5, num * 0.5));
            const rounded = Math.round(scaled);
            
            // Format as +XX or -XX (always 3 characters)
            if (rounded >= 0) {
                return '+' + String(Math.abs(rounded)).padStart(2, '0');
            } else {
                return '-' + String(Math.abs(rounded)).padStart(2, '0');
            }
        };
        
        const xFormatted = formatNumber(session.x);
        const yFormatted = formatNumber(session.y);
        
        // Return EXACTLY 6 characters: +05-03 (NO QUOTES!)
        const result = xFormatted + yFormatted;
        
        console.log(`📡 Plain text for ${token}: ${result} (length: ${result.length})`);
        
        // Send raw text without any JSON formatting
        res.send(result);
        
    } catch (error) {
        console.error('❌ Error in /simple:', error);
        res.send('+00+00');  // Plain text, no quotes
    }
});

// Test endpoint specifically for PictoBlox debugging
app.get('/test', (req, res) => {
    res.json({
        message: 'Server is working!',
        timestamp: new Date().toISOString(),
        headers: req.headers,
        method: req.method,
        url: req.url
    });
});

// Catch-all error handler
app.use((err, req, res, next) => {
    console.error('💥 Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Handle 404s
app.use((req, res) => {
    console.log(`❓ 404 Not Found: ${req.method} ${req.path}`);
    res.status(404).json({
        error: 'Endpoint not found',
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    const startTime = new Date().toISOString();
    console.log(`🚀 Server listening on port ${PORT}`);
    console.log(`📅 Started at: ${startTime}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📦 Node version: ${process.version}`);
    console.log('📡 CORS enabled for all origins');
    console.log('🔧 PictoBlox compatibility mode enabled');
    
    // Log available endpoints
    console.log('\n📋 Available endpoints:');
    console.log('  GET  / - Web interface');
    console.log('  GET  /health - Server health');
    console.log('  GET  /sessions - Debug sessions');
    console.log('  GET  /test - Simple test endpoint');
    console.log('  POST /start - Create new session');
    console.log('  POST /update - Update motion data');
    console.log('  GET  /latest/:token - Get motion data');
    console.log('\n✅ Server ready for connections!');
});
