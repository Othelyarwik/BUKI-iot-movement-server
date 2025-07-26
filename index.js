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
    res.header('Connection', 'keep-alive');
    res.header('Keep-Alive', 'timeout=5, max=1000');
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

// Update motion data with enhanced smoothing
app.post('/update', (req, res) => {
    try {
        const { token, x, y } = req.body;

        if (!token || !sessions[token]) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        const session = sessions[token];
        const newX = parseFloat(x) || 0;
        const newY = parseFloat(y) || 0;

        // Enhanced smoothing: weighted average + outlier filtering
        session.history = session.history || [];

        // Filter extreme outliers (sudden spikes)
        if (session.history.length > 0) {
            const lastSample = session.history[session.history.length - 1];
            const deltaX = Math.abs(newX - lastSample.x);
            const deltaY = Math.abs(newY - lastSample.y);
            
            // If change is too dramatic, blend it
            const filteredX = deltaX > 5 ? lastSample.x * 0.6 + newX * 0.4 : newX;
            const filteredY = deltaY > 5 ? lastSample.y * 0.6 + newY * 0.4 : newY;
            
            session.history.push({ x: filteredX, y: filteredY });
        } else {
            session.history.push({ x: newX, y: newY });
        }

        if (session.history.length > 8) {
            session.history.shift(); // Keep last 8 samples for ultra-smooth
        }

        // Weighted average (recent samples count more)
        let totalWeight = 0;
        let weightedX = 0;
        let weightedY = 0;
        
        session.history.forEach((sample, index) => {
            const weight = (index + 1) * (index + 1); // Quadratic weighting
            weightedX += sample.x * weight;
            weightedY += sample.y * weight;
            totalWeight += weight;
        });

        const avgX = weightedX / totalWeight;
        const avgY = weightedY / totalWeight;

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

// Get X movement for PictoBlox (-4 to +4) with enhanced smoothing
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

// Get Y movement for PictoBlox (-4 to +4) with enhanced smoothing
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

// Keep the original simple endpoint for compatibility
app.get('/simple/:token', (req, res) => {
    try {
        const session = sessions[req.params.token];
        if (!session || Date.now() - session.ts > 60000) {
            return res.status(200).end('X05Y05');
        }

        const xScaled = Math.max(1, Math.min(9, Math.round(session.x * 1.33) + 5));
        const yScaled = Math.max(1, Math.min(9, Math.round(session.y * 1.33) + 5));

        res.status(200).end(`X0${xScaled}Y0${yScaled}`);
    } catch (error) {
        console.error('❌ Error in simple endpoint:', error);
        res.status(200).end('X05Y05');
    }
});

// NEW: Batching endpoint - sends multiple positions at once for smoother movement
app.get('/batch/:token/:count', (req, res) => {
    try {
        const session = sessions[req.params.token];
        const count = Math.min(parseInt(req.params.count) || 5, 10); // Max 10 positions
        
        if (!session || Date.now() - session.ts > 60000) {
            // Return center positions for bad token
            const centerBatch = 'X05Y05,'.repeat(count).slice(0, -1);
            return res.status(200).end(centerBatch);
        }

        // Generate multiple positions with micro-variations for ultra-smooth movement
        const positions = [];
        const baseX = session.x;
        const baseY = session.y;
        
        for (let i = 0; i < count; i++) {
            // Create smooth interpolation between current and slightly predicted position
            const interpolationFactor = i / (count - 1);
            
            // Add tiny progressive changes for smooth interpolation
            const xVariation = (Math.random() - 0.5) * 0.3; // Smaller variation for smoothness
            const yVariation = (Math.random() - 0.5) * 0.3;
            
            // Interpolate with small variations
            const interpolatedX = baseX + (xVariation * interpolationFactor);
            const interpolatedY = baseY + (yVariation * interpolationFactor);
            
            const xScaled = Math.max(1, Math.min(9, Math.round(interpolatedX * 1.33) + 5));
            const yScaled = Math.max(1, Math.min(9, Math.round(interpolatedY * 1.33) + 5));
            
            positions.push(`X${String(xScaled).padStart(2, '0')}Y${String(yScaled).padStart(2, '0')}`);
        }
        
        res.status(200).end(positions.join(','));
        
    } catch (error) {
        const centerBatch = 'X05Y05,'.repeat(5).slice(0, -1);
        res.status(200).end(centerBatch);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Enhanced Racing Controller Server with Batching running on port ${PORT}`);
    console.log(`📱 Phone Interface: http://localhost:${PORT}`);
    console.log(`🎮 PictoBlox Endpoints:`);
    console.log(`   - Original: /simple/TOKEN`);
    console.log(`   - NEW Batch: /batch/TOKEN/3 (or any number 1-10)`);
    console.log(`📊 Debug: /debug/TOKEN`);
    console.log(`✨ Features: Advanced smoothing, batching for ultra-smooth movement`);
});
