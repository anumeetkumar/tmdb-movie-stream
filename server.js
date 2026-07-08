require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { config } = require('./utils/config');
const { createProxyRoutes } = require('./proxy/proxyServer');

// Import MVC Routers
const apiRoutes = require('./routes/apiRoutes');
const playerRoutes = require('./routes/playerRoutes');

const app = express();
app.set('trust proxy', 1); // Trust Vercel/reverse-proxy x-forwarded-proto so req.protocol === 'https'
app.use(cors());
app.use(express.json());

// Mount HLS proxy routes early so they handle streaming segments
createProxyRoutes(app);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'fast-stream-resolver', time: new Date().toISOString() });
});

// Serve static playground assets from public directory
app.use(express.static('public'));

// Register MVC Routers
app.use('/api', apiRoutes);
app.use('/play', playerRoutes);
app.use('/embed', playerRoutes);

const PORT = process.env.PORT || 8788;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`High-Performance Stream Resolver listening on port ${PORT}`);
  console.log(`- Health Check: GET http://localhost:${PORT}/api/health`);
  console.log(`- Fast Resolve: GET http://localhost:${PORT}/api/resolve/movie/299534`);
  console.log(`- Full Resolve: GET http://localhost:${PORT}/api/resolve-all/movie/299534`);
  console.log(`- Stream Play:  GET http://localhost:${PORT}/play/movie/299534`);
  console.log(`- Suggestions:  GET http://localhost:${PORT}/api/suggestions/movie/299534`);
  console.log(`======================================================\n`);
});
