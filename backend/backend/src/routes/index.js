const express = require('express');
const { healthCheck } = require('../controllers/healthController');
const adsRoutes = require('./adsRoutes');

const router = express.Router();

router.get('/health', healthCheck);
router.use('/ads', adsRoutes);

module.exports = router;
