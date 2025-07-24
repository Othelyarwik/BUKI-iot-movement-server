const express = require('express');
const cors = require('cors');

const app = express();

// Enhanced CORS configuration
app.use(cors({ 
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Type']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Comprehensive request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`📡 ${timestamp} - ${req.method} ${req.path}`);
    console.log(`🌐 Origin: ${req.get('Origin') || 'none'}`);
    console.log(`📋 User-Agent: ${req.get('User-Agent') || 'unknown'}`);
    
    if (req.body && Object.keys(req.body).length > 0) {
        console.log(`📝 Request Body:`, JSON.stringify(req.body));
    }
    
    if (req.query && Object.keys(req.query).length > 0) {
        console.log(`❓ Query Params:`, JSON.stringify(req.query));
    }
    
    next();
});

// In-memory sessions storage
const sessions = {};

// Session cleanup every 2 minutes
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    Object.keys(sessions).forEach(token => {
        if (now - sessions[token].ts > 120000) { // 2 minutes
            delete sessions[token];
            cleaned++;
        }
    });
    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired sessions`);
    }
}, 120000);

// Serve the main phone interface
app.get('/', (req, res) => {
    console.log('📱 Serving phone interface');
    res.sendFile(__dirname + '/public/index.html');
});

// Create new session and generate token
app.post('/start', (req, res) => {
    try {
        console.log('🎯 Creating new session...');
        
        // Custom alphabet without confusing characters: no l, I, O, 0, 1
        const clearChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
        
        // Generate 8-character token using only clear characters
        let token = '';
        for (let i = 0; i < 8; i++) {
            token += clearChars.charAt(Math.floor(Math.random() * clearChars.length));
        }
        
        // Create session with initial data
        sessions[token] = { 
            x: 0, 
            y: 0, 
            ts: Date.now(),
            created: new Date().toISOString()
        };
        
        console.log(`✅ Created session with token: ${token}`);
        console.log(`📊 Total active sessions: ${Object.keys(sessions).length}`);
        
        // Send JSON response with proper headers
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ 
            token: token,
            timestamp: new Date().toISOString(),
            success: true
        });
        
    } catch (error) {
        console.error('❌ Error creating session:', error);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ 
            error: 'Failed to create session',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Update phone movement data
app.post('/update', (req, res) => {
    try {
        const { token, x, y } = req.body;
        
        console.log(`📲 Update request - Token: ${token}, X: ${x}, Y: ${y}`);
        
        if (!token) {
            console.log('❌ Missing token in update request');
            res.setHeader('Content-Type', 'application/json');
            res.status(400).json({ error: 'Token is required' });
            return;
        }
        
        if (sessions[token]) {
            // Update session data
            sessions[token] = { 
                x: parseFloat(x) || 0, 
                y: parseFloat(y) || 0, 
                ts: Date.now(),
                lastUpdate: new Date().toISOString()
            };
            
            console.log(`✅ Session updated for ${token}: x=${x}, y=${y}`);
            
            res.setHeader('Content-Type', 'application/json');
            res.status(200).json({ 
                ok: true,
                timestamp: new Date().toISOString()
            });
        } else {
            console.log(`❌ Invalid token in update: ${token}`);
            console.log(`📋 Available tokens: [${Object.keys(sessions).join(', ')}]`);
            
            res.setHeader('Content-Type', 'application/json');
            res.status(400).json({ 
                error: 'Invalid or expired token',
                providedToken: token,
                availableTokens: Object.keys(sessions).length
            });
        }
        
    } catch (error) {
        console.error('❌ Error in update endpoint:', error);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ 
            error: 'Update failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get X movement value for PictoBlox
app.get('/x/:token', (req, res) => {
    try {
        const requestedToken = req.params.token;
        console.log(`🎮 X endpoint request for token: ${requestedToken}`);
        
        const session = sessions[requestedToken];
        
        if (!session) {
            console.log(`❌ No session found for token: ${requestedToken}`);
            res.setHeader('Content-Type', 'text/plain');
            res.status(404).end('0');
            return;
        }
        
        const age = Date.now() - session.ts;
        console.log(`⏰ Session age: ${Math.round(age/1000)}s`);
        
        if (age >= 60000) { // 1 minute expiry
            console.log(`❌ Session expired for token: ${requestedToken}`);
            delete sessions[requestedToken];
            res.setHeader('Content-Type', 'text/plain');
            res.status(404).end('0');
            return;
        }
        
        // Calculate movement value
        const movement = Math.max(-5, Math.min(5, Math.round(session.x * 0.5)));
        console.log(`✅ X endpoint returning: ${movement} (from session.x: ${session.x})`);
        
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).end(movement.toString());
        
    } catch (error) {
        console.error('❌ Error in X endpoint:', error);
        res.setHeader('Content-Type', 'text/plain');
        res.status(500).end('0');
    }
});

// Get Y movement value for PictoBlox  
app.get('/y/:token', (req, res) => {
    try {
        const requestedToken = req.params.token;
        console.log(`🎮 Y endpoint request for token: ${requestedToken}`);
        
        const session = sessions[requestedToken];
        
        if (!session) {
            console.log(`❌ No session found for token: ${requestedToken}`);
            res.setHeader('Content-Type', 'text/plain');
            res.status(404).end('0');
            return;
        }
        
        const age = Date.now() - session.ts;
        console.log(`⏰ Session age: ${Math.round(age/1000)}s`);
        
        if (age >= 60000) { // 1 minute expiry
            console.log(`❌ Session expired for token: ${requestedToken}`);
            delete sessions[requestedToken];
            res.setHeader('Content-Type', 'text/plain');
            res.status(404).end('0');
            return;
        }
        
        // Calculate movement value
        const movement = Math.max(-5, Math.min(5, Math.round(session.y * 0.5)));
        console.log(`✅ Y endpoint returning: ${movement} (from session.y: ${session.y})`);
        
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).end(movement.toString());
        
    } catch (error) {
        console.error('❌ Error in Y endpoint:', error);
        res.setHeader('Content-Type', 'text/plain');
        res.status(500).end('0');
    }
});

// Debug endpoint to inspect sessions
app.get('/debug/:token', (req, res) => {
    try {
        const requestedToken = req.params.token;
        const session = sessions[requestedToken];
        
        const debugInfo = {
            requestedToken: requestedToken,
            sessionExists: !!session,
            sessionData: session || null,
            sessionAge: session ? Math.round((Date.now() - session.ts) / 1000) + 's' : 'N/A',
            totalSessions: Object.keys(sessions).length,
            allTokens: Object.keys(sessions),
            currentTime: new Date().toISOString(),
            serverUptime: Math.round(process.uptime()) + 's'
        };
        
        console.log('🔍 Debug request:', debugInfo);
        
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(debugInfo);
        
    } catch (error) {
        console.error('❌ Error in debug endpoint:', error);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint to verify server is working
app.get('/test', (req, res) => {
    console.log('🧪 Test endpoint called');
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).end('Server is working!');
});

// Health check endpoint
app.get('/health', (req, res) => {
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeSessions: Object.keys(sessions).length,
        uptime: Math.round(process.uptime()) + 's',
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    };
    
    console.log('❤️ Health check:', healthData);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(healthData);
});

// 404 handler
app.use((req, res) => {
    console.log(`❓ 404 Not Found: ${req.method} ${req.path}`);
    res.setHeader('Content-Type', 'application/json');
    res.status(404).json({
        error: 'Endpoint not found',
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('💥 Unhandled error:', err);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    const startTime = new Date().toISOString();
    console.log(`🚀 Server started successfully!`);
    console.log(`📡 Listening on port: ${PORT}`);
    console.log(`⏰ Started at: ${startTime}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📦 Node version: ${process.version}`);
    console.log(`🔧 Ready for connections!`);
});
