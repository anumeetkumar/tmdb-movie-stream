/**
 * Routing Layer - API Router Configuration
 */

const express = require('express');
const router = express.Router();
const { resolveFast, resolveAll, resolveFastVidzeeStream } = require('../controllers/resolveController');
const { getSuggestions } = require('../controllers/suggestionController');

// Resolver routes
router.get('/resolve/:type/:id', resolveFast);
router.get('/resolve-all/:type/:id', resolveAll);
router.get('/stream-fast/:type/:id', resolveFastVidzeeStream);

// Suggestions route
router.get('/suggestions/:type/:id', getSuggestions);

module.exports = router;
