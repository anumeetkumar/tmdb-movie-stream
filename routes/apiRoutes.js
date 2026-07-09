/**
 * Routing Layer - API Router Configuration
 */

const express = require('express');
const router = express.Router();
const { resolveFast, resolveAll, resolveFastVidzeeStream, resolveNxsha, resolveStremFx, getMetadata } = require('../controllers/resolveController');
const { getSuggestions } = require('../controllers/suggestionController');

// Resolver routes
router.get('/resolve/:type/:id', resolveFast);
router.get('/resolve-all/:type/:id', resolveAll);
router.get('/resolve-nxsha/:type/:id', resolveNxsha);
router.get('/resolve-stremfx/:type/:id', resolveStremFx);
router.get('/stream-fast/:type/:id', resolveFastVidzeeStream);
router.get('/metadata/:type/:id', getMetadata);

// Suggestions route
router.get('/suggestions/:type/:id', getSuggestions);

module.exports = router;
