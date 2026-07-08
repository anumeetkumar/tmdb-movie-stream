const axios = require('axios');

/**
 * Validates a single stream object by checking if its URL is reachable and returns a success status.
 * @param {Object} stream - The stream object containing url and optional headers.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @returns {Promise<boolean>} - True if valid, false otherwise.
 */
async function isValidStream(stream, timeoutMs = 1500) {
  if (!stream || !stream.url) return false;
  
  // Reject placeholder URLs (they must be decrypted/resolved first)
  if (stream.url.startsWith('placeholder_')) return false;

  // Skip active validation for DahmerMovies worker (it rate-limits multiple parallel requests with 429)
  if (stream.url.includes('111477.xyz')) return true;

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

  const validationPromises = streams.map(async (stream) => {
    const valid = await isValidStream(stream, timeoutMs);
    return valid ? stream : null;
  });

  const results = await Promise.all(validationPromises);
  return results.filter(Boolean);
}

module.exports = { isValidStream, filterValidStreams };
