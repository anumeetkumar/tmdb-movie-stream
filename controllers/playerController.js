/**
 * Controller Layer - Streaming Player Interface Logic
 * Streams are loaded client-side via the resolve API — page renders instantly.
 */

const axios = require('axios');
const { config } = require('../utils/config');

async function playStream(req, res) {
  const { type, id } = req.params;
  const normalizedType = type === 'series' || type === 'tv' ? 'tv' : 'movie';
  const season = req.query.season || req.query.s ? Number(req.query.season || req.query.s) : null;
  const episode = req.query.episode || req.query.e ? Number(req.query.episode || req.query.e) : null;

  // 1. Fetch TMDB Metadata only (fast — no stream fetching blocks this)
  let mediaTitle = `${type.toUpperCase()} - ${id}`;
  let mediaSubtitle = '';
  let posterUrl = '';
  try {
    const keys = config.tmdbApiKeys && config.tmdbApiKeys.length ? config.tmdbApiKeys : [config.tmdbApiKey];
    const activeKey = keys[Math.floor(Math.random() * keys.length)];
    if (activeKey) {
      const { data } = await axios.get(`https://api.themoviedb.org/3/${normalizedType}/${id}?api_key=${activeKey}`, { timeout: 4000 });
      mediaTitle = data.title || data.name || mediaTitle;
      mediaSubtitle = data.tagline || data.overview || '';
      if (mediaSubtitle.length > 150) mediaSubtitle = mediaSubtitle.substring(0, 150) + '...';
      if (data.backdrop_path) posterUrl = `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`;
      if (season !== null && episode !== null) mediaTitle += ` (S${season}E${episode})`;
    }
  } catch (e) { /* Ignore metadata errors */ }

  // 2. Build the resolve API URL the client will call
  let resolveUrl = `/api/resolve/${normalizedType}/${id}`;
  const params = [];
  if (season !== null) params.push(`season=${season}`);
  if (episode !== null) params.push(`episode=${episode}`);
  if (params.length) resolveUrl += `?${params.join('&')}`;

  // 3. Render page immediately — client JS will fetch & load streams
  const { renderPlayerPage } = require('../views/playerTemplates');
  res.send(renderPlayerPage(mediaTitle, mediaSubtitle, [], resolveUrl, posterUrl));
}

module.exports = { playStream };
