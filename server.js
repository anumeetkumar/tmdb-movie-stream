require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { config } = require('./utils/config');
const { listProviders, getProvider } = require('./providers/registry');
const { resolveImdbId } = require('./utils/tmdb');
const { applyFilters } = require('./utils/streamFilters');
const cache = require('./utils/cache');
const { filterValidStreams } = require('./utils/validator');
const { createProxyRoutes, processStreamsForProxy } = require('./proxy/proxyServer');

const app = express();
app.use(cors());
app.use(express.json());

// Mount HLS proxy routes early
createProxyRoutes(app);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'fast-stream-resolver', time: new Date().toISOString() });
});

// TMDB Recommendations/Suggestions Route
app.get('/api/suggestions/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const tmdbType = type === 'movie' ? 'movie' : 'tv';
  const axios = require('axios');
  
  const keys = config.tmdbApiKeys && config.tmdbApiKeys.length ? config.tmdbApiKeys : [config.tmdbApiKey];
  const activeKey = keys[Math.floor(Math.random() * keys.length)];
  
  if (!activeKey) {
    return res.json({ success: false, suggestions: [] });
  }
  
  try {
    const { data } = await axios.get(`https://api.tmdb.org/3/${tmdbType}/${id}/recommendations?api_key=${activeKey}`, { timeout: 5000 });
    const suggestions = (data.results || []).slice(0, 10).map(item => ({
      id: item.id,
      title: item.title || item.name || '',
      poster_path: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
      backdrop_path: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
      release_date: item.release_date || item.first_air_date || '',
      vote_average: item.vote_average || null
    }));
    res.json({ success: true, suggestions });
  } catch (e) {
    res.json({ success: false, error: e.message, suggestions: [] });
  }
});

// High-Performance Stream Resolver Route
app.get('/api/resolve/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const tmdbId = id;
  const normalizedType = type === 'series' || type === 'tv' ? 'tv' : 'movie';
  const providerType = normalizedType === 'tv' ? 'series' : 'movie'; // for provider compatibility

  const season = req.query.season || req.query.s ? Number(req.query.season || req.query.s) : null;
  const episode = req.query.episode || req.query.e ? Number(req.query.episode || req.query.e) : null;
  const forceRefresh = req.query.force === 'true' || req.query.forceRefresh === 'true';

  const formatStreams = (streamsList) => {
    const useProxy = config.enableProxy || req.query.proxy !== 'false';
    if (useProxy && Array.isArray(streamsList)) {
      const serverUrl = `${req.protocol}://${req.get('host')}`;
      let processed = processStreamsForProxy(streamsList, serverUrl);
      return processed.map(s => {
        if (s && typeof s === 'object') {
          const { headers, ...rest } = s;
          return rest;
        }
        return s;
      });
    }
    return streamsList;
  };

  // 1. Check TTL Cache
  if (!forceRefresh) {
    const cachedStreams = cache.get(normalizedType, tmdbId, season, episode);
    if (cachedStreams) {
      console.log(`[Resolver] Cache hit for ${normalizedType} ${tmdbId} S:${season} E:${episode} - returned ${cachedStreams.length} streams in <1ms`);
      return res.json({ success: true, fromCache: true, count: cachedStreams.length, streams: formatStreams(cachedStreams) });
    }
  }

  try {
    const imdbId = await resolveImdbId(normalizedType, tmdbId);
    const selectedProviders = (config.defaultProviders.length ? config.defaultProviders : listProviders().map(p => p.name));
    
    let resolved = false;
    const allProviderStreams = [];
    const completedProviders = new Set();

    // Helper to send response immediately when the fastest provider completes
    const sendFastestResponse = (providerName, validStreams, duration) => {
      if (resolved) return;
      resolved = true;
      console.log(`[Resolver] Fast response triggered by ${providerName} in ${duration}ms with ${validStreams.length} valid streams`);
      const formatted = formatStreams(validStreams);
      res.json({
        success: true,
        tmdbId,
        imdbId,
        fromCache: false,
        fastestProvider: providerName,
        durationMs: duration,
        count: formatted.length,
        streams: formatted
      });
    };

    // Run all providers concurrently
    const promises = selectedProviders.map(async (name) => {
      const prov = getProvider(name);
      if (!prov || !prov.enabled) return;

      const t0 = Date.now();
      try {
        console.log(`[Resolver] Running provider: ${name}`);
        const streams = await prov.fetch({ tmdbId, type: providerType, season, episode, imdbId, sr: req.query.sr || null, filters: {} });
        const duration = Date.now() - t0;

        if (Array.isArray(streams) && streams.length > 0) {
          // Filter quality/codec using project configuration
          let filtered = applyFilters(streams, name, config.minQualities, config.excludeCodecs);
          
          // Concurrently validate working links
          const validated = await filterValidStreams(filtered);
          
          if (validated.length > 0) {
            allProviderStreams.push(...validated);
            // Respond with the fastest working provider streams
            sendFastestResponse(name, validated, duration);
          }
        }
      } catch (err) {
        console.error(`[Resolver] Provider ${name} error:`, err.message);
      } finally {
        completedProviders.add(name);
      }
    });

    // Wait for all providers to complete in background. 
    // This allows cache warming with all discovered streams.
    Promise.allSettled(promises).then(async () => {
      // Warm the TTL cache with all streams gathered across all providers (store direct URLs raw)
      if (allProviderStreams.length > 0) {
        // Deduplicate streams by URL
        const uniqueStreams = [];
        const seenUrls = new Set();
        for (const s of allProviderStreams) {
          if (!seenUrls.has(s.url)) {
            seenUrls.add(s.url);
            uniqueStreams.push(s);
          }
        }
        cache.set(normalizedType, tmdbId, season, episode, uniqueStreams);
        console.log(`[Resolver] Cache populated for ${normalizedType} ${tmdbId} S:${season} E:${episode} with ${uniqueStreams.length} streams`);
      }

      // If no streams were found by any provider, return empty list
      if (!resolved) {
        res.json({ success: true, fromCache: false, count: 0, streams: [] });
      }
    });

  } catch (err) {
    console.error('[Resolver] Resolution error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'RESOLUTION_ERROR', message: err.message });
    }
  }
});

const PORT = process.env.PORT || 8788;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`High-Performance Stream Resolver listening on port ${PORT}`);
  console.log(`- Health Check: GET http://localhost:${PORT}/api/health`);
  console.log(`- Resolve URL:  GET http://localhost:${PORT}/api/resolve/movie/299534`);
  console.log(`- Suggestions:  GET http://localhost:${PORT}/api/suggestions/movie/299534`);
  console.log(`======================================================\n`);
});
