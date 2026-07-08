/**
 * Routing Layer - Player Router Configuration
 */

const express = require('express');
const router = express.Router();
const { playStream } = require('../controllers/playerController');

// Streaming Player Route
router.get('/:type/:id', playStream);

module.exports = router;
