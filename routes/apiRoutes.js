/**
 * Routing Layer - API Router Configuration
 */

const express = require('express');
const router = express.Router();
const { resolveFast, resolveAll } = require('../controllers/resolveController');
const { getSuggestions } = require('../controllers/suggestionController');

// Resolver routes
router.get('/resolve/:type/:id', resolveFast);
router.get('/resolve-all/:type/:id', resolveAll);

// Suggestions route
router.get('/suggestions/:type/:id', getSuggestions);

module.exports = router;
