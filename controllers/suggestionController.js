/**
 * Controller Layer - TMDB Suggestions / Recommendations Logic
 */

const axios = require('axios');
const { config } = require('../utils/config');

async function getSuggestions(req, res) {
  const { type, id } = req.params;
  const tmdbType = type === 'movie' ? 'movie' : 'tv';
  
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
}

module.exports = {
  getSuggestions
};
