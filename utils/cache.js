class StreamCache {
  constructor(defaultTtlMs = 1000 * 60 * 60 * 6) { // Default 6 hours TTL
    this.cache = new Map();
    this.defaultTtlMs = defaultTtlMs;
  }

  generateKey(type, tmdbId, season = null, episode = null) {
    return `${type}:${tmdbId}:${season || ''}:${episode || ''}`;
  }

  get(type, tmdbId, season = null, episode = null) {
    const key = this.generateKey(type, tmdbId, season, episode);
    const item = this.cache.get(key);
    if (!item) return null;

    // If cache is expired, delete and return null
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.streams;
  }

  set(type, tmdbId, season = null, episode = null, streams, ttlMs = this.defaultTtlMs) {
    const key = this.generateKey(type, tmdbId, season, episode);
    
    // Default expiration
    let earliestExpiryMs = Date.now() + ttlMs;

    if (Array.isArray(streams)) {
      for (const s of streams) {
        if (!s || !s.url) continue;
        try {
          const parsedUrl = new URL(s.url);
          const params = ['expires', 'expire', 'exp', 'expires_at'];
          for (const p of params) {
            const val = parsedUrl.searchParams.get(p);
            if (val) {
              const num = parseInt(val, 10);
              if (!isNaN(num) && num > 0) {
                // Determine if Unix time is in seconds or milliseconds
                const ms = num < 100000000000 ? num * 1000 : num;
                // Clamp TTL to the earliest future token expiration
                if (ms > Date.now() && ms < earliestExpiryMs) {
                  earliestExpiryMs = ms;
                  console.log(`[Cache] Dynamic cache clamping applied. Token parameter '${p}' expires in ${Math.round((ms - Date.now()) / 1000)}s.`);
                }
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }

    this.cache.set(key, { streams, expiresAt: earliestExpiryMs });
  }

  clear() {
    this.cache.clear();
  }
}

module.exports = new StreamCache();
