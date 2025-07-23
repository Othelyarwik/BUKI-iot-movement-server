// 1. Load needed modules
const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const path = require('path');

// 2. Create server app
const app = express();
app.use(cors());
app.use(express.json());

// 3. Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// 4. Redundantly serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 5. Session data
const sessions = {};

// 6. Give students unique tokens
app.post('/connect', (req, res) => {
  const token = nanoid(8);
  sessions[token] = { x: 0, y: 0, ts: Date.now() };
  res.json({ token });
});

// 7. Save phone motion data
app.post('/update', (req, res) => {
  const { token, x, y } = req.body;
  if (sessions[token]) {
    sessions[token] = { x, y, ts: Date.now() };
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'Invalid token' });
  }
});

// 8. Fetch the latest motion values
app.get('/latest/:token', (req, res) => {
  const s = sessions[req.params.token];
  if (s && Date.now() - s.ts < 30000) {
    res.json({ x: s.x, y: s.y });
  } else {
    res.status(404).json({ error: 'Session expired or not found' });
  }
});

// 9. Start HTTP server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
