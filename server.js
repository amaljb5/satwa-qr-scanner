const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize SQLite Database
const db = new Database('database.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    breakfast INTEGER DEFAULT 0,
    lunch INTEGER DEFAULT 0,
    dinner INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, date)
  );
`);

// Seed sample users if not exist
const sampleUsers = [
  { id: 'USER001', name: 'Rahul Sharma', email: 'rahul@example.com', phone: '+91 9876543210' },
  { id: 'USER002', name: 'Priya Patel', email: 'priya@example.com', phone: '+91 9876543211' },
  { id: 'USER003', name: 'Amit Kumar', email: 'amit@example.com', phone: '+91 9876543212' },
  { id: 'USER004', name: 'Sneha Reddy', email: 'sneha@example.com', phone: '+91 9876543213' },
  { id: 'USER005', name: 'Vikram Singh', email: 'vikram@example.com', phone: '+91 9876543214' }
];

const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name, email, phone) VALUES (?, ?, ?, ?)');
sampleUsers.forEach(user => {
  insertUser.run(user.id, user.name, user.email, user.phone);
});

// Get current date and next 2 days
function getThreeDays() {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 3; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

// API Routes

// Get user by ID
app.get('/api/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Get all users
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  res.json(users);
});

// Add new user
app.post('/api/users', (req, res) => {
  const { id, name, email, phone } = req.body;
  try {
    db.prepare('INSERT INTO users (id, name, email, phone) VALUES (?, ?, ?, ?)').run(id, name, email, phone);
    res.json({ success: true, id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get meals for a user (for all 3 days)
app.get('/api/meals/:userId', (req, res) => {
  const dates = getThreeDays();
  const meals = {};

  dates.forEach((date, index) => {
    let meal = db.prepare('SELECT * FROM meals WHERE user_id = ? AND date = ?').get(req.params.userId, date);

    // Create meal record if doesn't exist
    if (!meal) {
      db.prepare('INSERT INTO meals (user_id, date, breakfast, lunch, dinner) VALUES (?, ?, 0, 0, 0)').run(req.params.userId, date);
      meal = { user_id: req.params.userId, date, breakfast: 0, lunch: 0, dinner: 0 };
    }

    meals[`day${index + 1}`] = {
      date: date,
      breakfast: meal.breakfast === 1,
      lunch: meal.lunch === 1,
      dinner: meal.dinner === 1
    };
  });

  res.json(meals);
});

// Update meal status
app.post('/api/meals', (req, res) => {
  const { userId, date, mealType, status } = req.body;

  try {
    // Ensure record exists
    const existing = db.prepare('SELECT * FROM meals WHERE user_id = ? AND date = ?').get(userId, date);

    if (!existing) {
      db.prepare('INSERT INTO meals (user_id, date, breakfast, lunch, dinner) VALUES (?, ?, 0, 0, 0)').run(userId, date);
    }

    // Update the specific meal
    const statusInt = status ? 1 : 0;
    db.prepare(`UPDATE meals SET ${mealType} = ? WHERE user_id = ? AND date = ?`).run(statusInt, userId, date);

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get dates info
app.get('/api/dates', (req, res) => {
  res.json(getThreeDays());
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🍽️  Food QR Scanner running at http://localhost:${PORT}`);
  console.log(`📱 Sample User IDs for QR codes: USER001, USER002, USER003, USER004, USER005`);
});
