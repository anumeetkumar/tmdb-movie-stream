/**
 * Controller Layer - Stream Resolving Logic
 */

const { config } = require('../utils/config');
const { listProviders, getProvider } = require('../providers/registry');
const { resolveImdbId } = require('../utils/tmdb');
const { applyFilters } = require('../utils/streamFilters');
const cache = require('../utils/cache');
const { processStreamsForProxy } = require('../proxy/proxyServer');

// Helper to format and wrap stream URLs through local proxy if enabled
const formatStreamsHelper = (streamsList, req) => {
  const useProxy = config.enableProxy || req.query.proxy !== 'false';
  if (useProxy && Array.isArray(streamsList)) {
    // x-forwarded-proto is set by Vercel/nginx; trust proxy must be enabled (set in server.js)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const serverUrl = `${protocol}://${req.get('host')}`;
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


// Route 1: Fast racer resolver endpoint (returns first finished provider in ms)
async function resolveFast(req, res) {
  const { type, id } = req.params;
  const tmdbId = id;
  const normalizedType = type === 'series' || type === 'tv' ? 'tv' : 'movie';
  const providerType = normalizedType === 'tv' ? 'series' : 'movie';

  const extractNum = (val) => {
    if (!val) return null;
    const m = String(val).match(/\d+/);
    return m ? Number(m[0]) : null;
  };

  const season = req.query.season ? extractNum(req.query.season) : (req.query.s ? extractNum(req.query.s) : null);
  const episode = req.query.episode ? extractNum(req.query.episode) : (req.query.e ? extractNum(req.query.e) : null);
  const forceRefresh = req.query.force === 'true' || req.query.forceRefresh === 'true';

  // 1. Check TTL Cache
  if (!forceRefresh) {
    const cachedStreams = cache.get(normalizedType, tmdbId, season, episode);
    if (cachedStreams) {
      console.log(`[Resolver] Cache hit for ${normalizedType} ${tmdbId} S:${season} E:${episode} - returned ${cachedStreams.length} streams in <1ms`);
      return res.json({ success: true, fromCache: true, count: cachedStreams.length, streams: formatStreamsHelper(cachedStreams, req) });
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
      const formatted = formatStreamsHelper(validStreams, req);
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
          let filtered = applyFilters(streams, name, config.minQualities, config.excludeCodecs);
          if (filtered.length > 0) {
            allProviderStreams.push(...filtered);
            sendFastestResponse(name, filtered, duration);
          }
        }
      } catch (err) {
        console.error(`[Resolver] Provider ${name} error:`, err.message);
      } finally {
        completedProviders.add(name);
      }
    });

    // Wait for all providers to complete in background (warm cache)
    Promise.allSettled(promises).then(async () => {
      if (allProviderStreams.length > 0) {
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
}

// Route 2: Full Validated Streams Resolver (waits for all scrapers to complete and returns all validated streams)
async function resolveAll(req, res) {
  const { type, id } = req.params;
  const tmdbId = id;
  const normalizedType = type === 'series' || type === 'tv' ? 'tv' : 'movie';
  const providerType = normalizedType === 'tv' ? 'series' : 'movie';

  const extractNum = (val) => {
    if (!val) return null;
    const m = String(val).match(/\d+/);
    return m ? Number(m[0]) : null;
  };

  const season = req.query.season ? extractNum(req.query.season) : (req.query.s ? extractNum(req.query.s) : null);
  const episode = req.query.episode ? extractNum(req.query.episode) : (req.query.e ? extractNum(req.query.e) : null);
  const forceRefresh = req.query.force === 'true' || req.query.forceRefresh === 'true';

  // Check TTL Cache
  if (!forceRefresh) {
    const cachedStreams = cache.get(normalizedType, tmdbId, season, episode);
    if (cachedStreams) {
      console.log(`[Resolver-All] Cache hit for ${normalizedType} ${tmdbId} S:${season} E:${episode} - returned ${cachedStreams.length} streams in <1ms`);
      return res.json({ success: true, fromCache: true, count: cachedStreams.length, streams: formatStreamsHelper(cachedStreams, req) });
    }
  }

  try {
    const imdbId = await resolveImdbId(normalizedType, tmdbId);
    const selectedProviders = (config.defaultProviders.length ? config.defaultProviders : listProviders().map(p => p.name));
    
    const allProviderStreams = [];
    const promises = selectedProviders.map(async (name) => {
      const prov = getProvider(name);
      if (!prov || !prov.enabled) return;

      try {
        console.log(`[Resolver-All] Running provider: ${name}`);
        const streams = await prov.fetch({ tmdbId, type: providerType, season, episode, imdbId, sr: req.query.sr || null, filters: {} });
        if (Array.isArray(streams) && streams.length > 0) {
          let filtered = applyFilters(streams, name, config.minQualities, config.excludeCodecs);
          if (filtered.length > 0) {
            allProviderStreams.push(...filtered);
          }
        }
      } catch (err) {
        console.error(`[Resolver-All] Provider ${name} error:`, err.message);
      }
    });

    // Wait for all providers to complete and validate
    await Promise.allSettled(promises);

    // Deduplicate streams by URL
    const uniqueStreams = [];
    const seenUrls = new Set();
    for (const s of allProviderStreams) {
      if (!seenUrls.has(s.url)) {
        seenUrls.add(s.url);
        uniqueStreams.push(s);
      }
    }

    // Warm the TTL Cache (store raw direct URLs)
    if (uniqueStreams.length > 0) {
      cache.set(normalizedType, tmdbId, season, episode, uniqueStreams);
      console.log(`[Resolver-All] Cache populated for ${normalizedType} ${tmdbId} S:${season} E:${episode} with ${uniqueStreams.length} streams`);
    }

    const formatted = formatStreamsHelper(uniqueStreams, req);
    res.json({
      success: true,
      tmdbId,
      imdbId,
      fromCache: false,
      count: formatted.length,
      streams: formatted
    });

  } catch (err) {
    console.error('[Resolver-All] Resolution error:', err.message);
    res.status(500).json({ success: false, error: 'RESOLUTION_ERROR', message: err.message });
  }
}

// Route 3: Dedicated fast direct Vidzee stream scraper (returns direct CDN link without proxy)
async function resolveFastVidzeeStream(req, res) {
  const { type, id } = req.params;
  const tmdbId = id;
  const normalizedType = type === 'series' || type === 'tv' ? 'tv' : 'movie';
  const providerType = normalizedType === 'tv' ? 'series' : 'movie';

  const extractNum = (val) => {
    if (!val) return null;
    const m = String(val).match(/\d+/);
    return m ? Number(m[0]) : null;
  };

  const season = req.query.season ? extractNum(req.query.season) : (req.query.s ? extractNum(req.query.s) : null);
  const episode = req.query.episode ? extractNum(req.query.episode) : (req.query.e ? extractNum(req.query.e) : null);

  try {
    const { getVidzeeStreams } = require('../providers/vidzee');
    // Fetch specifically server 7 (Hindi)
    const streams = await getVidzeeStreams(tmdbId, normalizedType, season, episode, '7');

    if (!streams || streams.length === 0) {
      return res.status(404).json({ success: false, error: 'NO_STREAM_FOUND', message: 'No Vidzee Hindi stream found' });
    }

    const targetStream = streams[0];
    if (req.query.redirect === 'true') {
      return res.redirect(302, targetStream.url);
    }

    res.json({
      success: true,
      tmdbId,
      provider: 'Vidzee',
      server: 'Hindi (sr=7)',
      url: targetStream.url,
      subtitles: targetStream.subtitles || []
    });

  } catch (err) {
    console.error('[Resolver-Fast-Vidzee] Error:', err.message);
    res.status(500).json({ success: false, error: 'FAST_RESOLVE_ERROR', message: err.message });
  }
}

module.exports = {
  resolveFast,
  resolveAll,
  resolveFastVidzeeStream,
  formatStreamsHelper,
  getMetadata
};

// Route 4: Fetch metadata from TMDB (used by embed playground to resolve title/backdrop)
async function getMetadata(req, res) {
  const { type, id } = req.params;
  const normalizedType = type === 'series' || type === 'tv' ? 'tv' : 'movie';
  const axios = require('axios');
  try {
    const keys = config.tmdbApiKeys && config.tmdbApiKeys.length ? config.tmdbApiKeys : [config.tmdbApiKey];
    const activeKey = keys[Math.floor(Math.random() * keys.length)];
    if (!activeKey) {
      return res.json({ success: false, title: `${type.toUpperCase()} - ${id}` });
    }
    const { data } = await axios.get(`https://api.themoviedb.org/3/${normalizedType}/${id}?api_key=${activeKey}`, { timeout: 4000 });
    res.json({
      success: true,
      title: data.title || data.name || '',
      tagline: data.tagline || '',
      overview: data.overview || '',
      backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : ''
    });
  } catch (e) {
    res.json({ success: false, title: `${type.toUpperCase()} - ${id}` });
  }
}
