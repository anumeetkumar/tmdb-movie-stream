const axios = require('axios');
const CryptoJS = require('crypto-js');

const keyStr = 'S8x!Jk4ZP1uG8$my';

function encodeData(data) {
  const payload = {
    ...data,
    _req_ts: Date.now(),
    _req_salt: Math.random().toString(36).substring(2, 12)
  };
  const str = JSON.stringify(payload);
  return CryptoJS.AES.encrypt(str, keyStr)
    .toString()
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function decodeData(ciphertext) {
  let r = ciphertext.replace(/-/g, "+").replace(/_/g, "/");
  while (r.length % 4 !== 0) {
    r += "=";
  }
  const bytes = CryptoJS.AES.decrypt(r, keyStr);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

async function getNxshaStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
  console.log(`[Nxsha] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);
  
  const type = mediaType === 'series' || mediaType === 'tv' ? 'tv' : 'movie';
  const season = seasonNum ? Number(seasonNum) : 1;
  const episode = episodeNum ? Number(episodeNum) : 1;

  // Step 1: Query Servers List
  const serverPayload = {
    tmdbId: String(tmdbId),
    imdb_id: "",
    type,
    season,
    episode
  };

  const allStreams = [];
  try {
    const serverQ = encodeData(serverPayload);
    const serversUrl = `https://nxsha.space/api/servers?q=${serverQ}`;
    
    const serversRes = await axios.get(serversUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
        'Referer': `https://nxsha.space/embed/${type}/${tmdbId}`
      },
      timeout: 8000
    });

    if (!serversRes.data || !serversRes.data._hash) {
      console.log('[Nxsha] No servers returned.');
      return [];
    }

    const decryptedServers = decodeData(serversRes.data._hash);
    const serversList = decryptedServers.servers || [];
    if (serversList.length === 0) {
      return [];
    }

    // Step 2: Query sources from all servers concurrently
    const promises = serversList.map(async (server) => {
      const sourcePayload = {
        ex_lang: "",
        provider: server.scraper,
        tmdbId: String(tmdbId),
        imdb_id: "",
        type,
        season,
        episode
      };

      const sourceQ = encodeData(sourcePayload);
      const sourcesUrl = `https://nxsha.space/api/sources?q=${sourceQ}`;

      try {
        const sourcesRes = await axios.get(sourcesUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
            'Referer': `https://nxsha.space/embed/${type}/${tmdbId}`
          },
          timeout: 8000
        });

        if (sourcesRes.data && sourcesRes.data._hash) {
          const decryptedSources = decodeData(sourcesRes.data._hash);
          const sources = decryptedSources.sources || [];
          
          for (const s of sources) {
            if (!s.url || s.type === 'embed') continue;

            let finalUrl = s.url;
            if (finalUrl.includes('proxy.valhallastream.dpdns.org')) {
              try {
                const parsedUrl = new URL(finalUrl);
                const innerUrl = parsedUrl.searchParams.get('url');
                if (innerUrl) {
                  finalUrl = `https://xbm.robotz-server.workers.dev/?url=${encodeURIComponent(innerUrl)}`;
                }
              } catch (e) {
                // fallback to original
              }
            } else if (finalUrl.includes('workers.dev/?url=')) {
              finalUrl = finalUrl.replace(/https:\/\/[a-zA-Z0-9-.]+\.workers\.dev\/\?url=/, 'https://xbm.robotz-server.workers.dev/?url=');
            } else if (finalUrl.includes('bcdnxw.hakunaymatata.com') && !finalUrl.includes('xbm.robotz-server.workers.dev')) {
              finalUrl = `https://xbm.robotz-server.workers.dev/?url=${encodeURIComponent(finalUrl)}`;
            }
            
            // Format Quality
            let qLabel = 'Auto';
            if (s.quality) {
              const qStr = String(s.quality).toLowerCase();
              if (qStr.includes('1080') || qStr.includes('fhd')) qLabel = '1080p';
              else if (qStr.includes('720') || qStr.includes('hd')) qLabel = '720p';
              else if (qStr.includes('480') || qStr.includes('sd')) qLabel = '480p';
              else if (qStr.includes('360')) qLabel = '360p';
              else qLabel = s.quality;
            }

            allStreams.push({
              name: `Nxsha - ${server.name}`,
              title: s.label || s.quality || `Nxsha ${server.name}`,
              url: finalUrl,
              quality: qLabel,
              provider: 'Nxsha',
              headers: s.headers || null
            });
          }
        }
      } catch (err) {
        // Skip individual server failures silently
      }
    });

    await Promise.allSettled(promises);
    console.log(`[Nxsha] Successfully resolved ${allStreams.length} stream(s).`);
    return allStreams;

  } catch (err) {
    console.error(`[Nxsha] Error: ${err.message}`);
    return [];
  }
}

module.exports = { getNxshaStreams };
