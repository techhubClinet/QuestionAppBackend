require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const voteRoutes = require('./routes/votes');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/questions', questionRoutes);
app.use('/votes', voteRoutes);
app.use('/admin', adminRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Mamekubal API is running' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

module.exports = app;
