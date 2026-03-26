const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-User-Id']
}));
app.use(express.json({ limit: '5mb' }));

// Serve dashboard as static files
app.use(express.static(path.join(__dirname, '..', 'dashboard')));

// ─── Helper: read/write user data ───────────────────────────────────
function getUserFilePath(userId) {
  // Sanitize userId to prevent path traversal
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(DATA_DIR, `${safeId}.json`);
}

function readUserData(userId) {
  const filePath = getUserFilePath(userId);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`Error reading data for ${userId}:`, e.message);
    }
  }
  return null;
}

function writeUserData(userId, data) {
  const filePath = getUserFilePath(userId);
  data.lastSynced = Date.now();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ─── API Routes ─────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'ImpulseGuard API', timestamp: Date.now() });
});

// POST /api/sync — Extension pushes all data to server
app.post('/api/sync', (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId. Send X-User-Id header or userId in body.' });
    }

    const {
      hourlyWage,
      totalMoneySpent,
      totalHoursSpent,
      totalMoneySavedByCancelling,
      totalHoursSavedByCancelling,
      decisionHistory,
      lastUpdated
    } = req.body;

    const userData = {
      userId,
      hourlyWage: hourlyWage || 500,
      totalMoneySpent: totalMoneySpent || 0,
      totalHoursSpent: totalHoursSpent || 0,
      totalMoneySavedByCancelling: totalMoneySavedByCancelling || 0,
      totalHoursSavedByCancelling: totalHoursSavedByCancelling || 0,
      decisionHistory: (decisionHistory || []).slice(0, 200),
      lastUpdated: lastUpdated || Date.now(),
      lastSynced: Date.now()
    };

    writeUserData(userId, userData);
    console.log(`✅ Synced data for user: ${userId} | Saved: ₹${userData.totalMoneySavedByCancelling} | Spent: ₹${userData.totalMoneySpent} | Decisions: ${userData.decisionHistory.length}`);

    res.json({ success: true, message: 'Data synced successfully', lastSynced: userData.lastSynced });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/data/:userId — Dashboard fetches user data
app.get('/api/data/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const userData = readUserData(userId);
    if (!userData) {
      return res.json({
        userId,
        hourlyWage: 500,
        totalMoneySpent: 0,
        totalHoursSpent: 0,
        totalMoneySavedByCancelling: 0,
        totalHoursSavedByCancelling: 0,
        decisionHistory: [],
        lastUpdated: Date.now(),
        isNew: true
      });
    }

    res.json(userData);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users — List all users (admin/debug)
app.get('/api/users', (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    const users = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      return {
        userId: data.userId,
        totalSaved: data.totalMoneySavedByCancelling || 0,
        totalSpent: data.totalMoneySpent || 0,
        decisions: (data.decisionHistory || []).length,
        lastSynced: data.lastSynced
      };
    });
    res.json({ count: users.length, users });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Serve Dashboard ────────────────────────────────────────────────
// Fallback: serve dashboard.html for any non-API route
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'dashboard', 'index.html'));
  }
});

// ─── Start Server ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   🛡️  ImpulseGuard API Server Running       ║');
  console.log(`  ║   📡  http://localhost:${PORT}                  ║`);
  console.log('  ║   📊  Dashboard: http://localhost:3000       ║');
  console.log('  ║   💾  Data stored in: ./data/                ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});
