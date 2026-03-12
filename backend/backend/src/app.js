const express = require('express');
const cors = require('cors');

const routes = require('./routes');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the backend API',
  });
});

app.use('/api', routes);

module.exports = app;
