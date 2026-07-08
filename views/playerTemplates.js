/**
 * Views Layer - Dynamic Player with client-side stream validation and dual-phase loading.
 * Loads fast stream (Vidzee Hindi) instantly, then loads all other streams in background.
 */

function renderPlayerPage(mediaTitle, mediaSubtitle, resolveUrl, fastStreamUrl, posterUrl) {
  const safeTitle = (mediaTitle || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safeSub = (mediaSubtitle || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safeResolveUrl = (resolveUrl || '').replace(/'/g, "\\'");
  const safeFastStreamUrl = (fastStreamUrl || '').replace(/'/g, "\\'");
  const safePoster = (posterUrl || '').replace(/'/g, "\\'");

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Playing: ${mediaTitle}</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Outfit', sans-serif;
            background: radial-gradient(circle at center, #111b2d 0%, #080c14 100%);
            color: #fff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        .container {
            width: 95%; max-width: 1100px;
            background: rgba(255,255,255,0.03);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 24px; padding: 24px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            display: flex; flex-direction: column; gap: 20px;
            animation: fadeIn 0.8s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .header {
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            padding-bottom: 16px; flex-wrap: wrap; gap: 12px;
        }
        .title-area h1 {
            font-size: 24px; font-weight: 800;
            background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .title-area p { font-size: 14px; color: #8a99ad; margin-top: 4px; }
        .source-select-area { display: flex; align-items: center; gap: 10px; }
        .source-label { font-size: 13px; color: #8a99ad; font-weight: 600; white-space: nowrap; }
        .source-select {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #fff; padding: 8px 16px; border-radius: 12px;
            font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600;
            outline: none; cursor: pointer; max-width: 320px;
        }
        .source-select option { background: #0f172a; color: #fff; }
        .player-wrapper {
            position: relative; width: 100%; aspect-ratio: 16/9;
            background: #000; border-radius: 16px; overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.05);
        }
        #player { width: 100%; height: 100%; }
        #loading-overlay {
            position: absolute; inset: 0;
            background: rgba(8,12,20,0.93);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            z-index: 20; gap: 14px; border-radius: 16px;
            transition: opacity 0.4s ease;
        }
        #loading-overlay.hidden { opacity: 0; pointer-events: none; }
        .load-spinner {
            width: 44px; height: 44px;
            border: 4px solid rgba(255,255,255,0.1);
            border-left-color: #00f2fe;
            border-radius: 50%;
            animation: spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .load-text { color: #8a99ad; font-size: 14px; font-weight: 600; }
        .load-subtext { color: #3d5166; font-size: 12px; }
        .footer {
            display: flex; justify-content: space-between; align-items: center;
            font-size: 13px; color: #63758d; flex-wrap: wrap; gap: 10px;
        }
        .btn {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            border: none; color: #fff; padding: 10px 20px; border-radius: 12px;
            font-weight: 600; cursor: pointer; text-decoration: none;
            transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(79,172,254,0.3);
        }
        .btn:hover { transform: translateY(-2px); }
        .btn-secondary {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #ccc; box-shadow: none;
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .controls-info { display: flex; gap: 15px; flex-wrap: wrap; }
        #stream-status { font-size: 12px; color: #00f2fe; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title-area">
                <h1>${mediaTitle}</h1>
                <p>${mediaSubtitle}</p>
            </div>
            <div class="source-select-area">
                <span class="source-label">Source:</span>
                <select id="source-select" class="source-select" disabled>
                    <option>Locating fast stream...</option>
                </select>
            </div>
        </div>
        <div class="player-wrapper">
            <div id="player"></div>
            <div id="loading-overlay">
                <div class="load-spinner"></div>
                <div class="load-text" id="load-text">Connecting to fast stream...</div>
                <div class="load-subtext">Initializing Vidzee Hindi (unproxied)</div>
            </div>
        </div>
        <div class="footer">
            <div class="controls-info">
                <span>Space: Play/Pause</span>
                <span>Double Click: Fullscreen</span>
                <span id="stream-status"></span>
            </div>
            <div style="display:flex;gap:10px;">
                <a class="btn btn-secondary" href="${resolveUrl}" target="_blank">Raw Links</a>
                <button class="btn" onclick="location.reload()">Reload</button>
            </div>
        </div>
    </div>
    <script>
        var RESOLVE_URL     = '${safeResolveUrl}';
        var FAST_STREAM_URL = '${safeFastStreamUrl}';
        var POSTER          = '${safePoster}';

        var overlay  = document.getElementById('loading-overlay');
        var loadText = document.getElementById('load-text');
        var select   = document.getElementById('source-select');
        var statusEl = document.getElementById('stream-status');

        var art              = null;
        var streams          = [];
        var errorTimer       = null;
        var currentIdx       = 0;
        var failedSet        = new Set(); // indices of confirmed-dead streams
        var fastStreamLoaded = false;
        var fullStreamsLoaded = false;

        // ─── Helpers ────────────────────────────────────────────────────────────
        function isHls(url) {
            return url && (url.indexOf('.m3u8') !== -1 || url.indexOf('m3u8-proxy') !== -1);
        }
        function isProxy(url) {
            return url && (url.indexOf('/m3u8-proxy') !== -1 || url.indexOf('/ts-proxy') !== -1);
        }
        function hideOverlay() {
            overlay.classList.add('hidden');
            setTimeout(function() { overlay.style.display = 'none'; }, 400);
        }

        // ─── Dropdown state ──────────────────────────────────────────────────────
        function markFailed(idx) {
            if (failedSet.has(idx)) return;
            failedSet.add(idx);
            var opt = select.options[idx];
            if (opt) {
                opt.textContent = '[✗] ' + opt.textContent.replace('[✗] ', '');
                opt.style.color = '#ff4444';
                opt.disabled    = true;
            }
            var alive = streams.length - failedSet.size;
            statusEl.textContent = alive + '/' + streams.length + ' stream(s) alive';
        }

        function markAlive(idx) {
            var opt = select.options[idx];
            if (opt && !failedSet.has(idx)) {
                opt.style.color = '#00e676';
            }
        }

        // ─── Background preflight ────────────────────────────────────────────────
        async function preflightCheck(url, idx) {
            if (!isProxy(url)) return; 
            try {
                var ctrl = new AbortController();
                var tid  = setTimeout(function() { ctrl.abort(); }, 8000);
                var res  = await fetch(url, { signal: ctrl.signal });
                clearTimeout(tid);
                if (!res.ok) { markFailed(idx); return; }
                var ct = (res.headers.get('content-type') || '').toLowerCase();
                if (ct.indexOf('application/json') !== -1 || ct.indexOf('text/html') !== -1) {
                    markFailed(idx); return;
                }
                markAlive(idx);
            } catch (e) {
                markFailed(idx);
            }
        }

        // ─── Player ──────────────────────────────────────────────────────────────
        function initPlayer(stream) {
            if (!stream || !stream.url) return;

            if (art) {
                art.switchUrl(stream.url).catch(function() {});
                return;
            }

            art = new Artplayer({
                container: '#player',
                url:    stream.url,
                type:   isHls(stream.url) ? 'm3u8' : 'video',
                poster: POSTER || undefined,
                customType: {
                    m3u8: function(video, url) {
                        if (Hls.isSupported()) {
                            var hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
                            hls.loadSource(url);
                            hls.attachMedia(video);
                            video._hls = hls;
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            video.src = url;
                        }
                    }
                },
                volume: 0.8, isLive: false, muted: false,
                autoplay: true, pip: true, autoSize: true,
                autoMini: true, screenshot: true, setting: true,
                loop: false, flip: true, playbackRate: true,
                aspectRatio: true, fullscreen: true, fullscreenWeb: true,
                subtitleOffset: true, miniProgressBar: true, mutex: true,
                backdrop: true, playsInline: true, autoPlayback: true,
                airplay: true, theme: '#00f2fe',
                moreVideoAttr: { crossOrigin: 'anonymous' }
            });

            art.on('error', function() {
                if (errorTimer) return;
                markFailed(currentIdx);
                errorTimer = setTimeout(function() {
                    errorTimer = null;
                    var next = currentIdx + 1;
                    while (next < streams.length && failedSet.has(next)) next++;
                    if (next < streams.length) {
                        console.warn('[Player] #' + (currentIdx+1) + ' failed → trying #' + (next+1) + '/' + streams.length);
                        currentIdx    = next;
                        select.value  = String(next);
                        playStream(streams[next]);
                    } else {
                        statusEl.textContent = 'All sources exhausted.';
                    }
                }, 1500);
            });
        }

        function playStream(stream) {
            if (!stream || !stream.url) return;
            if (art) {
                art.switchUrl(stream.url).catch(function() {});
            } else {
                initPlayer(stream);
            }
        }

        // ─── Dropdown ────────────────────────────────────────────────────────────
        function populateSelect(list) {
            select.innerHTML = '';
            list.forEach(function(s, i) {
                var opt       = document.createElement('option');
                opt.value     = String(i);
                opt.textContent = '[' + (s.provider || '?') + '] ' +
                                  (s.name || s.title || 'Stream') +
                                  ' (' + (s.quality || 'Auto') + ')';
                select.appendChild(opt);
            });
            select.disabled = false;
        }

        select.addEventListener('change', function(e) {
            var idx = parseInt(e.target.value, 10);
            if (isNaN(idx) || idx < 0 || idx >= streams.length) return;
            currentIdx = idx;
            var stream = streams[idx];
            if (!stream || !stream.url) return;
            console.log('[Player] Manual → #' + (idx+1) + ' ' + (stream.provider||'?') + ' ' + (stream.name||''));
            playStream(stream);
        });

        // ─── Phase 1: Fast Stream Load (Vidzee Hindi) ──────────────────────────
        async function loadFastStream() {
            try {
                var res = await fetch(FAST_STREAM_URL, { cache: 'no-store' });
                if (!res.ok) throw new Error('Fast API error');
                var data = await res.json();
                
                if (data && data.success && data.url) {
                    fastStreamLoaded = true;
                    // If full streams haven't loaded yet, start playing fast stream immediately
                    if (!fullStreamsLoaded) {
                        var fastStream = {
                            name: data.server || 'Hindi (sr=7)',
                            title: data.server || 'Hindi (sr=7)',
                            url: data.url,
                            quality: 'Auto',
                            provider: 'Vidzee',
                            subtitles: data.subtitles || []
                        };
                        streams = [fastStream];
                        currentIdx = 0;
                        populateSelect(streams);
                        statusEl.textContent = 'Playing fast stream...';
                        hideOverlay();
                        initPlayer(fastStream);
                    }
                }
            } catch (e) {
                console.warn('[Player] Fast stream load failed:', e);
            }
        }

        // ─── Phase 2: Full Streams Load (Background) ─────────────────────────────
        async function loadFullStreams() {
            try {
                var res  = await fetch(RESOLVE_URL, { cache: 'no-store' });
                if (!res.ok) throw new Error('Full API ' + res.status);
                var data = await res.json();
                var fetched = (data.streams || []).filter(function(s) {
                    return s && typeof s.url === 'string' && s.url.length > 4;
                });

                if (fetched.length === 0) {
                    if (!fastStreamLoaded) {
                        loadText.textContent = 'No streams found. Retrying in 4s...';
                        setTimeout(loadFullStreams, 4000);
                    }
                    return;
                }

                fullStreamsLoaded = true;

                // Merge streams: we want to keep the currently playing/resolved streams intact,
                // but populate the select with the full list.
                var oldPlayingUrl = (streams[currentIdx] || {}).url;
                streams = fetched;

                // Update select dropdown with all resolved streams
                populateSelect(streams);
                statusEl.textContent = streams.length + ' stream(s) available';

                // Find index of the currently playing stream in the new list to keep selection aligned
                var foundMatchIdx = -1;
                if (oldPlayingUrl) {
                    for (var i = 0; i < streams.length; i++) {
                        if (streams[i].url === oldPlayingUrl) {
                            foundMatchIdx = i;
                            break;
                        }
                    }
                }

                if (foundMatchIdx !== -1) {
                    currentIdx = foundMatchIdx;
                    select.value = String(currentIdx);
                } else {
                    // If we weren't playing anything yet (fast stream failed/slow), start playing the first one
                    if (!art) {
                        currentIdx = 0;
                        select.value = '0';
                        hideOverlay();
                        initPlayer(streams[0]);
                    }
                }

                // Background: preflight check all proxy URLs concurrently
                streams.forEach(function(s, i) {
                    if (isProxy(s.url)) preflightCheck(s.url, i);
                });

            } catch (err) {
                console.error('[Player] loadFullStreams error:', err);
                if (!fastStreamLoaded && !fullStreamsLoaded) {
                    loadText.textContent = 'Error loading. Retrying...';
                    setTimeout(loadFullStreams, 4000);
                }
            }
        }

        // Kick off both phases concurrently
        loadFastStream();
        loadFullStreams();
    </script>
</body>
</html>`;
}

module.exports = { renderPlayerPage };
