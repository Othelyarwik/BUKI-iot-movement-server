const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 1️⃣ Serve static files (e.g., public/index.html)
app.use(express.static(path.join(__dirname, 'public')));

// 2️⃣ Safety fallback for GET /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 3️⃣ Your token and motion endpoints:
const sessions = {};

app.post('/connect', (req, res) => {
  const token = nanoid(8);
  sessions[token] = { x:0, y:0, ts: Date.now() };
  res.json({ token });
});

app.post('/update', (req, res) => {
  const { token, x, y } = req.body;
  if (sessions[token]) {
    sessions[token] = { x, y, ts: Date.now() };
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'Invalid token' });
  }
});

app.get('/latest/:token', (req, res) => {
  const s = sessions[req.params.token];
  if (s && (Date.now() - s.ts < 30000)) {
    res.json({ x: s.x, y: s.y });
  } else {
    res.status(404).json({ error: 'Session expired or not found' });
  }
});

// 4️⃣ Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
