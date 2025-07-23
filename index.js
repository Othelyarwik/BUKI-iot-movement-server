const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const path = require('path');

const app = express();
app.use(cors());

// Parse both application/json and text/plain bodies
app.use(express.json());
app.use(express.text());

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const sessions = {};

app.post('/connect', (req, res) => {
  const token = nanoid(8);
  sessions[token] = { x: 0, y: 0, ts: Date.now() };
  res.json({ token });
});

app.post('/update', (req, res) => {
  let data = req.body;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }
  const { token, x, y } = data;
  if (sessions[token]) {
    sessions[token] = { x, y, ts: Date.now() };
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'Invalid token' });
  }
});

app.get('/latest/:token', (req, res) => {
  const s = sessions[req.params.token];
  if (s && Date.now() - s.ts < 30000) {
    // MODIFIED PART: Nesting x and y values for PictoBlox
    res.json({
      x: {
        level1: {
          level2: {
            data: s.x // This is the actual X value
          }
        }
      },
      y: {
        level1: {
          level2: {
            data: s.y // This is the actual Y value
          }
        }
      }
    });
  } else {
    res.status(404).json({ error: 'Session expired or not found' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
