/**
 * Routing Layer - Player Router Configuration
 */

const express = require('express');
const router = express.Router();
const { playStream } = require('../controllers/playerController');

// Streaming Player Route
router.get(['/:type/:id', '/:type/:id/:season/:episode'], playStream);

module.exports = router;
