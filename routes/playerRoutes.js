/**
 * Routing Layer - Player Router Configuration
 */

const express = require('express');
const router = express.Router();
const { playStream, playStreamNxsha } = require('../controllers/playerController');

// Dedicated Nxsha Player Routes
router.get(['/nxsha/:type/:id', '/nxsha/:type/:id/:season/:episode'], playStreamNxsha);
router.get(['/nxsha/embed/:type/:id', '/nxsha/embed/:type/:id/:season/:episode'], playStreamNxsha);

// Streaming Player Route
router.get(['/:type/:id', '/:type/:id/:season/:episode'], playStream);

module.exports = router;
