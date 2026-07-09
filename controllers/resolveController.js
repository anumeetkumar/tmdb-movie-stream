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
        const verifiedStreams = await verifyStreamsInParallel(uniqueStreams);
        cache.set(normalizedType, tmdbId, season, episode, verifiedStreams);
        console.log(`[Resolver] Cache populated for ${normalizedType} ${tmdbId} S:${season} E:${episode} with ${verifiedStreams.length} verified streams`);
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
    let verifiedStreams = [];
    if (uniqueStreams.length > 0) {
      verifiedStreams = await verifyStreamsInParallel(uniqueStreams);
      cache.set(normalizedType, tmdbId, season, episode, verifiedStreams);
      console.log(`[Resolver-All] Cache populated for ${normalizedType} ${tmdbId} S:${season} E:${episode} with ${verifiedStreams.length} verified streams`);
    }

    const formatted = formatStreamsHelper(verifiedStreams, req);
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

// Route 5: Dedicated Nxsha resolver endpoint (returns streams from Nxsha only)
async function resolveNxsha(req, res) {
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

  // Check cache (using distinct cache tmdbId suffix to avoid contamination)
  if (!forceRefresh) {
    const cachedStreams = cache.get(normalizedType, `${tmdbId}-nxsha`, season, episode);
    if (cachedStreams) {
      console.log(`[Resolver-Nxsha] Cache hit for ${normalizedType} ${tmdbId} S:${season} E:${episode} - returned ${cachedStreams.length} streams`);
      return res.json({ success: true, fromCache: true, count: cachedStreams.length, streams: cachedStreams });
    }
  }

  try {
    const imdbId = await resolveImdbId(normalizedType, tmdbId);
    const prov = getProvider('nxsha');
    if (!prov || !prov.enabled) {
      return res.status(400).json({ success: false, error: 'NXSHA_DISABLED', message: 'Nxsha provider is disabled' });
    }

    console.log(`[Resolver-Nxsha] Running provider for tmdbId: ${tmdbId}`);
    const streams = await prov.fetch({ tmdbId, type: providerType, season, episode, imdbId, sr: req.query.sr || null, filters: {} });

    if (Array.isArray(streams) && streams.length > 0) {
      let filtered = applyFilters(streams, 'nxsha', config.minQualities, config.excludeCodecs);
      if (filtered.length > 0) {
        // Deduplicate
        const uniqueStreams = [];
        const seenUrls = new Set();
        for (const s of filtered) {
          if (!seenUrls.has(s.url)) {
            seenUrls.add(s.url);
            uniqueStreams.push(s);
          }
        }
        const verifiedStreams = await verifyStreamsInParallel(uniqueStreams);
        cache.set(normalizedType, `${tmdbId}-nxsha`, season, episode, verifiedStreams);
        console.log(`[Resolver-Nxsha] Resolved, verified & cached ${verifiedStreams.length} stream(s) for ${tmdbId}`);
        return res.json({
          success: true,
          tmdbId,
          imdbId,
          fromCache: false,
          count: verifiedStreams.length,
          streams: verifiedStreams
        });
      }
    }
    
    return res.json({ success: true, fromCache: false, count: 0, streams: [] });

  } catch (err) {
    console.error('[Resolver-Nxsha] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'NXSHA_RESOLVE_ERROR', message: err.message });
    }
  }
}

// Route 6: Dedicated StremFx resolver endpoint (returns streams from StremFx only)
async function resolveStremFx(req, res) {
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

  // Check cache (using distinct cache tmdbId suffix to avoid contamination)
  if (!forceRefresh) {
    const cachedStreams = cache.get(normalizedType, `${tmdbId}-stremfx`, season, episode);
    if (cachedStreams) {
      console.log(`[Resolver-StremFx] Cache hit for ${normalizedType} ${tmdbId} S:${season} E:${episode} - returned ${cachedStreams.length} streams`);
      return res.json({ success: true, fromCache: true, count: cachedStreams.length, streams: cachedStreams });
    }
  }

  try {
    const imdbId = await resolveImdbId(normalizedType, tmdbId);
    const prov = getProvider('stremfx');
    if (!prov || !prov.enabled) {
      return res.status(400).json({ success: false, error: 'STREMFX_DISABLED', message: 'StremFx provider is disabled' });
    }

    console.log(`[Resolver-StremFx] Running provider for tmdbId: ${tmdbId}`);
    const streams = await prov.fetch({ tmdbId, type: providerType, season, episode, imdbId, sr: req.query.sr || null, filters: {} });

    if (Array.isArray(streams) && streams.length > 0) {
      let filtered = applyFilters(streams, 'stremfx', config.minQualities, config.excludeCodecs);
      if (filtered.length > 0) {
        // Deduplicate
        const uniqueStreams = [];
        const seenUrls = new Set();
        for (const s of filtered) {
          if (!seenUrls.has(s.url)) {
            seenUrls.add(s.url);
            uniqueStreams.push(s);
          }
        }
        const verifiedStreams = await verifyStreamsInParallel(uniqueStreams);
        cache.set(normalizedType, `${tmdbId}-stremfx`, season, episode, verifiedStreams);
        console.log(`[Resolver-StremFx] Resolved, verified & cached ${verifiedStreams.length} stream(s) for ${tmdbId}`);
        return res.json({
          success: true,
          tmdbId,
          imdbId,
          fromCache: false,
          count: verifiedStreams.length,
          streams: verifiedStreams
        });
      }
    }
    
    return res.json({ success: true, fromCache: false, count: 0, streams: [] });

  } catch (err) {
    console.error('[Resolver-StremFx] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'STREMFX_RESOLVE_ERROR', message: err.message });
    }
  }
}

module.exports = {
  resolveFast,
  resolveAll,
  resolveFastVidzeeStream,
  resolveNxsha,
  resolveStremFx,
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

// Helper to preflight test if a stream link is alive
async function isStreamAlive(stream) {
  if (!stream || !stream.url) return false;
  
  // Reject unplayable formats in browser
  const lowerUrl = stream.url.toLowerCase();
  if (lowerUrl.includes('.mkv') || lowerUrl.includes('.avi') || lowerUrl.includes('.flv')) {
    console.log(`[Preflight-BE] Excluding unplayable format: ${stream.url}`);
    return false;
  }

  // Reject massive files (> 10GB) that cannot be streamed smoothly in browsers
  const isSizeTooLarge = (txt) => {
    if (!txt || typeof txt !== 'string') return false;
    const match = txt.match(/(\d+(?:\.\d+)?)\s*GB/i);
    if (match) {
      const sizeGB = parseFloat(match[1]);
      if (sizeGB > 10.0) return true;
    }
    return false;
  };

  if (isSizeTooLarge(stream.title) || isSizeTooLarge(stream.name)) {
    console.log(`[Preflight-BE] Excluding massive file size stream: ${stream.title || stream.name}`);
    return false;
  }

  const axios = require('axios');
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...(stream.headers || {})
    };

    // Try HEAD request first
    let response;
    try {
      response = await axios.head(stream.url, {
        headers,
        timeout: 2500,
        validateStatus: (status) => status >= 200 && status < 400
      });
    } catch (e) {
      // Fallback to GET requesting first few bytes
      const CancelToken = axios.CancelToken;
      const source = CancelToken.source();
      
      const getPromise = axios.get(stream.url, {
        headers: {
          ...headers,
          'Range': 'bytes=0-1024'
        },
        timeout: 2500,
        cancelToken: source.token,
        validateStatus: (status) => status >= 200 && status < 400
      });

      response = await getPromise;
      source.cancel('Check complete');
    }

    if (response && response.status >= 200 && response.status < 400) {
      const ct = (response.headers['content-type'] || '').toLowerCase();
      if (ct.includes('application/json') || (ct.includes('text/html') && !stream.url.includes('.m3u8'))) {
        return false;
      }
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

async function verifyStreamsInParallel(streams) {
  if (!Array.isArray(streams) || streams.length === 0) return [];
  if (!config.enableBackendPreflight) {
    console.log(`[Preflight-BE] Backend preflight checks disabled (enableBackendPreflight = false). Skipping stream validation.`);
    return streams;
  }
  console.log(`[Preflight-BE] Verifying ${streams.length} stream(s) on backend...`);
  const t0 = Date.now();
  
  const checkPromises = streams.map(async (stream) => {
    const alive = await isStreamAlive(stream);
    return alive ? stream : null;
  });
  
  const results = await Promise.all(checkPromises);
  const verified = results.filter(Boolean);
  
  console.log(`[Preflight-BE] Verification completed in ${Date.now() - t0}ms. ${verified.length}/${streams.length} stream(s) are alive.`);
  return verified;
}
