const axios = require('axios');

/**
 * Validates a single stream object by checking if its URL is reachable and returns a success status.
 * @param {Object} stream - The stream object containing url and optional headers.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @returns {Promise<boolean>} - True if valid, false otherwise.
 */
// Known CDN/hosting domains that are pre-validated and may block HEAD checks
const TRUSTED_BYPASS_PATTERNS = [
  'r2.cloudflarestorage.com',
  'pixeldrain.dev',
  'pixeldrain.com',
  'hubcloud.cx',
  'pixel.hubcloud.cx',
  'cloudflarestorage.com',
  'valhallastream.dpdns.org',
  'kkphimplayer',
  'gametechstore.shop',
  'hakunaymatata.com',
  'streamflixserver.site',
];

async function isValidStream(stream, timeoutMs = 1500) {
  if (!stream || !stream.url) return false;
  
  // Reject placeholder URLs (they must be decrypted/resolved first)
  if (stream.url.startsWith('placeholder_')) return false;

  // Trust-bypass known CDN patterns (pre-validated by upstream API, often block HEAD)
  if (TRUSTED_BYPASS_PATTERNS.some(p => stream.url.includes(p))) return true;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    ...(stream.headers || {})
  };

  try {
    // Attempt standard HEAD check first (extremely fast)
    await axios.head(stream.url, {
      headers,
      timeout: timeoutMs,
      validateStatus: (status) => status >= 200 && status < 400
    });
    return true;
  } catch (err) {
    // Fall back to GET check with Range header if HEAD fails (some CDNs block HEAD or return 405 Method Not Allowed)
    try {
      await axios.get(stream.url, {
        headers: {
          ...headers,
          'Range': 'bytes=0-0'
        },
        timeout: timeoutMs,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 206 || status === 302
      });
      return true;
    } catch (getErr) {
      console.log(`[Validator] Dead link check failed for ${stream.name || 'stream'}: ${getErr.message}`);
      return false;
    }
  }
}

/**
 * Concurrently validates an array of stream objects.
 * @param {Array} streams - List of stream objects.
 * @param {number} timeoutMs - Timeout per validation request.
 * @returns {Promise<Array>} - List of valid stream objects.
 */
async function filterValidStreams(streams, timeoutMs = 1500) {
  if (!Array.isArray(streams) || streams.length === 0) return [];

  // Separate DahmerMovies streams from normal streams
  const dahmerStreams = streams.filter(s => s.url && s.url.includes('111477.xyz'));
  const otherStreams = streams.filter(s => !s.url || !s.url.includes('111477.xyz'));

  // Validate other streams in parallel (extremely fast)
  const otherPromises = otherStreams.map(async (stream) => {
    const valid = await isValidStream(stream, timeoutMs);
    return valid ? stream : null;
  });

  // Validate DahmerMovies streams sequentially with a delay to avoid 429 rate limit
  const verifiedDahmer = [];
  for (let i = 0; i < dahmerStreams.length; i++) {
    const stream = dahmerStreams[i];
    if (i > 0) {
      await new Promise(r => setTimeout(r, 650)); // 650ms gap
    }
    const valid = await isValidStream(stream, timeoutMs);
    if (valid) {
      verifiedDahmer.push(stream);
    }
  }

  const verifiedOthers = (await Promise.all(otherPromises)).filter(Boolean);
  return [...verifiedOthers, ...verifiedDahmer];
}

module.exports = { isValidStream, filterValidStreams };
