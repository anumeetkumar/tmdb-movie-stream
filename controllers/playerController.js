/**
 * Controller Layer - Streaming Player Interface Logic
 */

const axios = require('axios');
const { config } = require('../utils/config');
const cache = require('../utils/cache');
const { processStreamsForProxy } = require('../proxy/proxyServer');
const { renderLoadingPage, renderPlayerPage } = require('../views/playerTemplates');

async function playStream(req, res) {
  const { type, id } = req.params;
  const tmdbId = id;
  const normalizedType = type === 'series' || type === 'tv' ? 'tv' : 'movie';
  const season = req.query.season || req.query.s ? Number(req.query.season || req.query.s) : null;
  const episode = req.query.episode || req.query.e ? Number(req.query.episode || req.query.e) : null;

  // 1. Fetch TMDB Metadata for details
  let mediaTitle = `${type.toUpperCase()} - ${id}`;
  let mediaSubtitle = '';
  try {
    const keys = config.tmdbApiKeys && config.tmdbApiKeys.length ? config.tmdbApiKeys : [config.tmdbApiKey];
    const activeKey = keys[Math.floor(Math.random() * keys.length)];
    if (activeKey) {
      const tmdbType = normalizedType;
      const { data } = await axios.get(`https://api.tmdb.org/3/${tmdbType}/${id}?api_key=${activeKey}`, { timeout: 4000 });
      mediaTitle = data.title || data.name || mediaTitle;
      mediaSubtitle = data.tagline || data.overview || '';
      if (mediaSubtitle.length > 150) mediaSubtitle = mediaSubtitle.substring(0, 150) + '...';
      if (season !== null && episode !== null) {
        mediaTitle += ` (S${season}E${episode})`;
      }
    }
  } catch (e) {
    // Ignore metadata load errors
  }

  // 2. Fetch streams (check cache, then try resolver)
  let streams = cache.get(normalizedType, tmdbId, season, episode);

  if (!streams || streams.length === 0) {
    try {
      const port = process.env.PORT || 8788;
      let url = `http://localhost:${port}/api/resolve/${normalizedType}/${id}`;
      const params = [];
      if (season !== null) params.push(`season=${season}`);
      if (episode !== null) params.push(`episode=${episode}`);
      if (params.length) url += `?${params.join('&')}`;
      
      const resolveRes = await axios.get(url, { timeout: 9500 });
      streams = resolveRes.data.streams;
    } catch (e) {
      console.log(`[Player Controller] Cache miss and background resolver is fetching...`);
    }
  }

  // Process and wrap streams through local proxy
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

  const formatted = formatStreams(streams || []);

  if (!formatted || formatted.length === 0) {
    // Render Loading View Template
    return res.send(renderLoadingPage(mediaTitle));
  }

  const selectedStream = formatted[0];
  
  // Format the raw links reference URL
  let rawLinksUrl = `/api/resolve/${type}/${id}`;
  const rawParams = [];
  if (season !== null) rawParams.push(`season=${season}`);
  if (episode !== null) rawParams.push(`episode=${episode}`);
  if (rawParams.length) rawLinksUrl += `?${rawParams.join('&')}`;

  // Render Play Video View Template
  res.send(renderPlayerPage(mediaTitle, mediaSubtitle, formatted, rawLinksUrl));
}

module.exports = {
  playStream
};
