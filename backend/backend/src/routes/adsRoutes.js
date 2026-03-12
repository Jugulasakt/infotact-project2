const express = require('express');
const { generateAd } = require('../controllers/adController');

const router = express.Router();

router.post('/generate', generateAd);

module.exports = router;
