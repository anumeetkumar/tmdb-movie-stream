/**
 * Views Layer - Dynamic Player with client-side stream validation and dual-phase loading.
 * Fully optimized for standard view and fullscreen iframe embedding.
 */

function renderPlayerPage(mediaTitle, mediaSubtitle, resolveUrl, fastStreamUrl, posterUrl, isEmbed = false) {
  const safeTitle = (mediaTitle || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safeSub = (mediaSubtitle || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safeResolveUrl = (resolveUrl || '').replace(/'/g, "\\'");
  const safeFastStreamUrl = (fastStreamUrl || '').replace(/'/g, "\\'");
  const safePoster = (posterUrl || '').replace(/'/g, "\\'");
  
  const bodyClass = isEmbed ? 'embed-mode' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stream ${mediaTitle} | TMDB Embed Player</title>
    
    <!-- SEO Optimization Meta Tags -->
    <meta name="description" content="Watch ${mediaTitle} for free on TMDB Embed Player. Direct HLS streams, multiple providers, clean playback, and responsive controls.">
    <meta name="keywords" content="TMDB Player, TMDB Embed, ${mediaTitle}, watch movie, stream tv show, embed player, ad-free streaming">
    <meta name="robots" content="index, follow">
    
    <!-- OpenGraph / Facebook Previews -->
    <meta property="og:type" content="video.movie">
    <meta property="og:title" content="Stream ${mediaTitle} on TMDB Embed Player">
    <meta property="og:description" content="Instant high-performance streaming. No pop-ups, clean interface.">
    <meta property="og:image" content="${posterUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1'}">
    <meta property="og:site_name" content="TMDB Player">
    
    <!-- Twitter Previews -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Stream ${mediaTitle} on TMDB Embed Player">
    <meta name="twitter:description" content="Watch ${mediaTitle} in HD with zero pop-ups.">
    <meta name="twitter:image" content="${posterUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1'}">

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
            transition: all 0.2s ease;
        }
        .source-select:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
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

        /* ─── Premium Embed Mode Styles ────────────────────────────────────────── */
        body.embed-mode {
            background: #000;
            padding: 0; margin: 0;
            overflow: hidden;
            width: 100vw; height: 100vh;
        }
        body.embed-mode .container {
            width: 100vw; height: 100vh;
            max-width: none; padding: 0;
            border: none; border-radius: 0;
            box-shadow: none; display: block;
            position: relative;
        }
        body.embed-mode .header, body.embed-mode .footer {
            display: none;
        }
        body.embed-mode .player-wrapper {
            width: 100vw; height: 100vh;
            aspect-ratio: auto; border: none;
            border-radius: 0;
        }
        body.embed-mode #loading-overlay {
            border-radius: 0;
        }
        body.embed-mode .source-select-area {
            position: absolute;
            top: 16px; right: 16px;
            z-index: 100;
            background: rgba(8, 12, 20, 0.7);
            backdrop-filter: blur(12px);
            padding: 6px 12px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            opacity: 1;
            transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            pointer-events: auto;
        }
        body.embed-mode .source-select-area.fade-out {
            opacity: 0;
            pointer-events: none;
            transform: translateY(-8px);
        }
        body.embed-mode .source-label {
            color: #fff;
        }
        body.embed-mode .source-select {
            background: rgba(255,255,255,0.08);
            border-color: rgba(255,255,255,0.15);
            font-size: 12px; padding: 6px 12px;
        }
    </style>
</head>
<body class="${bodyClass}">
    <div class="container">
        <div class="header">
            <div class="title-area">
                <h1>${mediaTitle}</h1>
                <p>${mediaSubtitle}</p>
            </div>
            <div class="source-select-area" id="select-wrapper">
                <span class="source-label">Source:</span>
                <select id="source-select" class="source-select" disabled>
                    <option>Locating fast stream...</option>
                </select>
            </div>
        </div>
        <div class="player-wrapper">
            <div id="player"></div>
            <!-- If we're inside embed mode, mount the selection dropdown overlay here instead -->
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
        var IS_EMBED        = ${isEmbed};

        var overlay  = document.getElementById('loading-overlay');
        var loadText = document.getElementById('load-text');
        var select   = document.getElementById('source-select');
        var statusEl = document.getElementById('stream-status');
        var wrapper  = document.getElementById('select-wrapper');

        var art              = null;
        var streams          = [];
        var errorTimer       = null;
        var currentIdx       = 0;
        var failedSet        = new Set(); // indices of confirmed-dead streams
        var fastStreamLoaded = false;
        var fullStreamsLoaded = false;

        // Move source dropdown into the video wrapper when in Embed Mode
        if (IS_EMBED) {
            document.querySelector('.player-wrapper').appendChild(wrapper);
            setupEmbedOverlayControls();
        }

        // ─── Embed Mode UI Overlay Auto-Hide Logic ──────────────────────────────
        function setupEmbedOverlayControls() {
            var hideTimer = null;
            function showControls() {
                wrapper.classList.remove('fade-out');
                clearTimeout(hideTimer);
                hideTimer = setTimeout(function() {
                    // Only hide if video is playing
                    if (art && art.playing) {
                        wrapper.classList.add('fade-out');
                    }
                }, 3000);
            }

            document.addEventListener('mousemove', showControls);
            document.addEventListener('touchstart', showControls);
            showControls();

            // Hook into player playing state
            setInterval(function() {
                if (art && !art.playing) {
                    wrapper.classList.remove('fade-out');
                }
            }, 1000);
        }

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
                var oldPlayingStream = streams[currentIdx];
                
                // If fast stream was loaded and is missing from full list, prepend it
                if (fastStreamLoaded && streams.length > 0) {
                    var fastStream = streams[0];
                    var exists = fetched.some(function(s) {
                        return s.url === fastStream.url || 
                               (s.provider === fastStream.provider && s.name === fastStream.name);
                    });
                    if (!exists) {
                        fetched.unshift(fastStream);
                    }
                }

                streams = fetched;

                // Update select dropdown with all resolved streams
                populateSelect(streams);
                statusEl.textContent = streams.length + ' stream(s) available';

                // Find index of the currently playing stream in the new list to keep selection aligned
                var foundMatchIdx = -1;
                if (oldPlayingStream) {
                    for (var i = 0; i < streams.length; i++) {
                        if (streams[i].url === oldPlayingStream.url ||
                            (streams[i].provider === oldPlayingStream.provider && streams[i].name === oldPlayingStream.name)) {
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

                // Rely on Backend Preflight checks — no need to check on frontend!
                // streams.forEach(function(s, i) {
                //     if (isProxy(s.url)) preflightCheck(s.url, i);
                // });

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

function renderNxshaPlayerPage(mediaTitle, mediaSubtitle, resolveUrl, posterUrl, isEmbed = false, brandName = 'Nxsha') {
  const safeTitle = (mediaTitle || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safeSub = (mediaSubtitle || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safeResolveUrl = (resolveUrl || '').replace(/'/g, "\\'");
  const safePoster = (posterUrl || '').replace(/'/g, "\\'");
  
  const bodyClass = isEmbed ? 'embed-mode' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stream ${mediaTitle} | ${brandName} Premium Player</title>
    
    <!-- SEO Optimization Meta Tags -->
    <meta name="description" content="Watch ${mediaTitle} for free on ${brandName} Premium Player. Direct multi-server streams with high quality resolution, clean playback, and responsive controls.">
    <meta name="keywords" content="${brandName} Player, ${brandName} Embed, ${mediaTitle}, watch movie, stream tv show, embed player, ad-free streaming">
    <meta name="robots" content="index, follow">
    
    <!-- OpenGraph / Facebook Previews -->
    <meta property="og:type" content="video.movie">
    <meta property="og:title" content="Stream ${mediaTitle} on ${brandName} Premium Player">
    <meta property="og:description" content="Instant high-performance streaming with multi-server support. No pop-ups, clean interface.">
    <meta property="og:image" content="${posterUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1'}">
    <meta property="og:site_name" content="${brandName} Player">
    
    <!-- Twitter Previews -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Stream ${mediaTitle} on ${brandName} Premium Player">
    <meta name="twitter:description" content="Watch ${mediaTitle} in HD with zero pop-ups.">
    <meta name="twitter:image" content="${posterUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1'}">

    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/video.js/8.10.0/video-js.min.css" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/video.js/8.10.0/video.min.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Outfit', sans-serif;
            background: radial-gradient(circle at center, #1b122d 0%, #0d0816 100%);
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
            box-shadow: 0 20px 50px rgba(0,0,0,0.6);
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
            background: linear-gradient(135deg, #a12cfc 0%, #187bf0 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .title-area p { font-size: 14px; color: #bcaed2; margin-top: 4px; }
        .source-select-area { display: flex; align-items: center; gap: 10px; }
        .source-label { font-size: 13px; color: #bcaed2; font-weight: 600; white-space: nowrap; }
        .source-select {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #fff; padding: 8px 16px; border-radius: 12px;
            font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600;
            outline: none; cursor: pointer; max-width: 320px;
            transition: all 0.2s ease;
        }
        .source-select:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
        .source-select option { background: #0d0816; color: #fff; }
        .player-wrapper {
            position: relative; width: 100%; aspect-ratio: 16/9;
            background: #000; border-radius: 16px; overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.05);
        }
        #player { width: 100%; height: 100%; }
        #loading-overlay {
            position: absolute; inset: 0;
            background: #08050e;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            z-index: 100; padding: 24px;
            color: #fff; text-align: center;
            border-radius: 16px;
            transition: opacity 0.4s ease;
        }
        #loading-overlay.hidden { opacity: 0; pointer-events: none; }
        .load-title {
            font-size: 24px; font-weight: 800; margin-bottom: 6px;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #fff 0%, #bcaed2 100%);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .load-status-text {
            font-size: 13px; color: #bcaed2; margin-bottom: 20px;
            font-weight: 500;
        }
        .progress-track {
            width: 80%; max-width: 440px; height: 5px;
            background: rgba(255,255,255,0.06);
            border-radius: 3px; overflow: hidden;
            margin-bottom: 8px; position: relative;
        }
        .progress-fill {
            height: 100%; width: 0%;
            background: linear-gradient(90deg, #f5a623, #f8e71c);
            box-shadow: 0 0 10px rgba(245, 166, 35, 0.4);
            border-radius: 3px;
            transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .progress-stats {
            width: 80%; max-width: 440px;
            display: flex; justify-content: space-between;
            font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
            margin-bottom: 24px;
        }
        .stats-analyzed { color: rgba(255,255,255,0.3); }
        .stats-remaining { color: #f5a623; }
        
        .server-grid {
            width: 100%; max-width: 640px;
            max-height: 180px; overflow-y: auto;
            display: flex; flex-wrap: wrap; justify-content: center;
            gap: 10px; padding: 4px;
        }
        .server-card {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 8px;
            padding: 8px 12px;
            display: flex; align-items: center; gap: 6px;
            min-width: 100px; justify-content: center;
            font-size: 11px; font-weight: 600;
            color: rgba(255,255,255,0.3);
            transition: all 0.3s ease;
        }
        .server-card.checking {
            border-color: rgba(245, 166, 35, 0.25);
            color: rgba(255,255,255,0.6);
        }
        .server-card.validated {
            background: rgba(46, 204, 113, 0.04);
            border-color: rgba(46, 204, 113, 0.25);
            color: #2ecc71;
            box-shadow: 0 0 10px rgba(46, 204, 113, 0.1);
            transform: translateY(-1px);
        }
        .server-card.failed {
            opacity: 0.15;
            transform: scale(0.96);
        }
        .check-icon {
            width: 12px; height: 12px; fill: none; stroke: currentColor;
            stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round;
            display: none;
        }
        .server-card.validated .check-icon {
            display: block;
        }
        .footer {
            display: flex; justify-content: space-between; align-items: center;
            font-size: 13px; color: #8e7fa5; flex-wrap: wrap; gap: 10px;
        }
        .btn {
            background: linear-gradient(135deg, #a12cfc 0%, #187bf0 100%);
            border: none; color: #fff; padding: 10px 20px; border-radius: 12px;
            font-weight: 600; cursor: pointer; text-decoration: none;
            transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(161,44,252,0.3);
        }
        .btn:hover { transform: translateY(-2px); }
        .btn-secondary {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #ccc; box-shadow: none;
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .controls-info { display: flex; gap: 15px; flex-wrap: wrap; }
        #stream-status { font-size: 12px; color: #a12cfc; }

        /* ─── Premium Embed Mode Styles ────────────────────────────────────────── */
        body.embed-mode {
            background: #000;
            padding: 0; margin: 0;
            overflow: hidden;
            width: 100vw; height: 100vh;
        }
        body.embed-mode .container {
            width: 100vw; height: 100vh;
            max-width: none; padding: 0;
            border: none; border-radius: 0;
            box-shadow: none; display: block;
            position: relative;
        }
        body.embed-mode .header, body.embed-mode .footer {
            display: none;
        }
        body.embed-mode .player-wrapper {
            width: 100vw; height: 100vh;
            aspect-ratio: auto; border: none;
            border-radius: 0;
        }
        body.embed-mode #loading-overlay {
            border-radius: 0;
        }
        body.embed-mode .source-select-area {
            position: absolute;
            top: 16px; right: 16px;
            z-index: 100;
            background: rgba(13, 8, 22, 0.85);
            backdrop-filter: blur(12px);
            padding: 6px 12px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            opacity: 1;
            transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            pointer-events: auto;
        }
        body.embed-mode .source-select-area.fade-out {
            opacity: 0;
            pointer-events: none;
            transform: translateY(-8px);
        }
        body.embed-mode .source-label {
            color: #fff;
        }
        body.embed-mode .source-select {
            background: rgba(255,255,255,0.08);
            border-color: rgba(255,255,255,0.15);
            font-size: 12px; padding: 6px 12px;
        }

        /* Custom Video.js Styling to match premium violet/dark theme */
        .video-js {
            background-color: #000;
        }
        .video-js .vjs-control-bar {
            background-color: rgba(13, 8, 22, 0.85) !important;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }
        .video-js .vjs-play-progress, .video-js .vjs-volume-level {
            background-color: #a12cfc !important;
        }
        .video-js .vjs-slider {
            background-color: rgba(255, 255, 255, 0.2) !important;
        }
        .video-js .vjs-big-play-button {
            background-color: rgba(161, 44, 252, 0.5) !important;
            border-color: #a12cfc !important;
            border-radius: 50% !important;
            width: 70px !important;
            height: 70px !important;
            line-height: 70px !important;
            margin-left: -35px !important;
            margin-top: -35px !important;
            transition: all 0.3s ease !important;
        }
        .video-js:hover .vjs-big-play-button {
            background-color: #a12cfc !important;
            transform: scale(1.1);
        }
        /* Customize video.js text tracks */
        .video-js .vjs-text-track-display {
          transform: translateY(-5%) !important;
          pointer-events: none !important;
        }
        .video-js .vjs-text-track-cue {
          background-color: transparent !important;
          text-align: center !important;
        }
        .video-js .vjs-text-track-cue > div {
          display: inline-block !important;
          background-color: rgba(0,0,0,0.75) !important;
          color: #FFFFFF !important;
          font-size: 1.25rem !important;
          font-family: sans-serif !important;
          font-weight: 600 !important;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9) !important;
          border-radius: 4px !important;
          padding: 2px 8px !important;
        }
    </style>
</head>
<body class="${bodyClass}">
    <div class="container">
        <div class="header">
            <div class="title-area">
                <h1>${mediaTitle}</h1>
                <p>${mediaSubtitle}</p>
            </div>
            <div class="source-select-area" id="select-wrapper">
                <span class="source-label">Server:</span>
                <select id="source-select" class="source-select" disabled>
                    <option>Loading ${brandName} servers...</option>
                </select>
            </div>
        </div>
        <div class="player-wrapper">
            <video id="player" class="video-js vjs-default-skin vjs-big-play-centered vjs-fill" controls playsinline crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: contain; background: #000;"></video>
            <div id="loading-overlay">
                <div class="load-title" id="overlay-title">${mediaTitle}</div>
                <div class="load-status-text" id="overlay-status">Scanning high-speed servers...</div>
                <div class="progress-track">
                    <div class="progress-fill" id="overlay-progress-fill"></div>
                </div>
                <div class="progress-stats">
                    <span class="stats-analyzed" id="overlay-analyzed">0 ANALYZED</span>
                    <span class="stats-remaining" id="overlay-remaining">0 REMAINING</span>
                </div>
                <div class="server-grid" id="overlay-server-grid">
                    <!-- Badges populated dynamically -->
                </div>
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
        var POSTER          = '${safePoster}';
        var IS_EMBED        = ${isEmbed};

        var overlay  = document.getElementById('loading-overlay');
        var loadText = document.getElementById('overlay-status');
        var select   = document.getElementById('source-select');
        var statusEl = document.getElementById('stream-status');
        var wrapper  = document.getElementById('select-wrapper');

        var streams          = [];
        var errorTimer       = null;
        var currentIdx       = 0;
        var failedSet        = new Set(); // indices of confirmed-dead streams
        var playerInstance   = null;

        // Move source dropdown into the video wrapper when in Embed Mode
        if (IS_EMBED) {
            document.querySelector('.player-wrapper').appendChild(wrapper);
            setupEmbedOverlayControls();
        }

        // ─── Embed Mode UI Overlay Auto-Hide Logic ──────────────────────────────
        function setupEmbedOverlayControls() {
            var hideTimer = null;
            function showControls() {
                wrapper.classList.remove('fade-out');
                clearTimeout(hideTimer);
                hideTimer = setTimeout(function() {
                    if (playerInstance && !playerInstance.paused()) {
                        wrapper.classList.add('fade-out');
                    }
                }, 3000);
            }

            document.addEventListener('mousemove', showControls);
            document.addEventListener('touchstart', showControls);
            showControls();

            setInterval(function() {
                if (playerInstance && playerInstance.paused()) {
                    wrapper.classList.remove('fade-out');
                }
            }, 1000);
        }

        function getPlayableUrl(stream) {
            if (!stream || !stream.url) return '';
            var original = stream.url;
            if (original.indexOf('/m3u8-proxy') !== -1 || original.indexOf('/ts-proxy') !== -1) {
                return original;
            }
            var host = '';
            try {
                host = new URL(original).hostname.toLowerCase();
            } catch (e) {}
            if (host.includes('111477.xyz') || host.endsWith('fvncw.com') || host.endsWith('bxncw.com') || host.includes('robotz-server.workers.dev')) {
                return original;
            }
            var headers = stream.headers || {};
            var hParam = Object.keys(headers).length ? '&headers=' + encodeURIComponent(JSON.stringify(headers)) : '';
            var serverUrl = window.location.origin;
            if (host.includes('pixeldrain.') || host === 'video-downloads.googleusercontent.com') {
                return serverUrl + '/ts-proxy?url=' + encodeURIComponent(original) + hParam;
            }
            if (/\.(mp4|mkv)(\?|$)/i.test(original)) {
                return serverUrl + '/ts-proxy?url=' + encodeURIComponent(original) + hParam;
            }
            return serverUrl + '/m3u8-proxy?url=' + encodeURIComponent(original) + hParam;
        }

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
            statusEl.textContent = alive + '/' + streams.length + ' server(s) alive';
        }

        var completedCount = 0;
        var hasStartedPlaying = false;

        async function preflightCheck(url, idx) {
            var card = document.getElementById('card-' + idx);
            if (card) card.className = 'server-card checking';
            
            var isSuccess = false;
            try {
                var ctrl = new AbortController();
                var tid  = setTimeout(function() { ctrl.abort(); }, 7000);
                var res  = await fetch(url, { signal: ctrl.signal });
                clearTimeout(tid);
                
                if (res.ok) {
                    var ct = (res.headers.get('content-type') || '').toLowerCase();
                    if (ct.indexOf('application/json') === -1 && (ct.indexOf('text/html') === -1 || url.indexOf('.m3u8') !== -1)) {
                        isSuccess = true;
                    }
                }
            } catch (e) {}

            completedCount++;
            var remainingCount = streams.length - completedCount;
            var percentage = Math.round((completedCount / streams.length) * 100);
            
            var fillEl = document.getElementById('overlay-progress-fill');
            var analyzedEl = document.getElementById('overlay-analyzed');
            var remainingEl = document.getElementById('overlay-remaining');
            
            if (fillEl) fillEl.style.width = percentage + '%';
            if (analyzedEl) analyzedEl.textContent = completedCount + ' ANALYZED';
            if (remainingEl) remainingEl.textContent = remainingCount + ' REMAINING';

            if (isSuccess) {
                if (card) card.className = 'server-card validated';
                streams[idx].isValidated = true;
                
                if (!hasStartedPlaying) {
                    hasStartedPlaying = true;
                    currentIdx = idx;
                    playStream(streams[idx]);
                    hideOverlay();
                }
                return true;
            } else {
                if (card) card.className = 'server-card failed';
                markFailed(idx);
                return false;
            }
        }

        var watchdogTimer = null;

        function startWatchdog() {
            clearWatchdog();
            watchdogTimer = setTimeout(function() {
                console.warn('[Watchdog] Stream loading stalled for 6.5 seconds. Auto-failing over...');
                if (playerInstance) {
                    playerInstance.trigger('error');
                }
            }, 6500);
        }

        function clearWatchdog() {
            if (watchdogTimer) {
                clearTimeout(watchdogTimer);
                watchdogTimer = null;
            }
        }

        function initPlayer(stream) {
            if (!stream || !stream.url) return;

            var pUrl = getPlayableUrl(stream);
            var mimeType = 'video/mp4';
            if (isHls(pUrl)) {
                mimeType = 'application/x-mpegURL';
            }

            if (playerInstance) {
                playerInstance.error(null);
                startWatchdog();
                playerInstance.src({
                    src: pUrl,
                    type: mimeType
                });
                if (POSTER) {
                    playerInstance.poster(POSTER);
                }
                playerInstance.play().catch(function(e) {
                    console.warn('[Player] Play blocked:', e);
                });
                return;
            }

            startWatchdog();
            playerInstance = videojs('player', {
                autoplay: true,
                controls: true,
                fluid: false,
                sources: [{
                    src: pUrl,
                    type: mimeType
                }]
            });

            if (POSTER) {
                playerInstance.poster(POSTER);
            }

            playerInstance.on('playing', function() {
                clearWatchdog();
                console.log('[Watchdog] Video started playing successfully. Watchdog cleared.');
            });

            playerInstance.on('error', function() {
                clearWatchdog();
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
                        statusEl.textContent = 'All servers exhausted.';
                    }
                }, 1500);
            });
        }

        function playStream(stream) {
            if (!stream || !stream.url) return;
            initPlayer(stream);
        }

        var BRAND_NAME = '${brandName}';

        function populateSelect(list) {
            select.innerHTML = '';
            list.forEach(function(s, i) {
                var opt       = document.createElement('option');
                opt.value     = String(i);
                opt.textContent = '[' + (s.provider || BRAND_NAME) + '] ' +
                                  (s.title || s.name || 'Stream') +
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
            console.log('[Player] Manual → #' + (idx+1) + ' ' + (stream.provider||BRAND_NAME) + ' ' + (stream.title||''));
            playStream(stream);
        });

        async function loadStreams() {
            try {
                var res  = await fetch(RESOLVE_URL, { cache: 'no-store' });
                if (!res.ok) throw new Error(BRAND_NAME + ' API ' + res.status);
                var data = await res.json();
                var fetched = (data.streams || []).filter(function(s) {
                    return s && typeof s.url === 'string' && s.url.length > 4;
                });

                if (fetched.length === 0) {
                    loadText.textContent = 'No streams found. Retrying in 4s...';
                    setTimeout(loadStreams, 4000);
                    return;
                }

                streams = fetched;
                
                // Reset progress tracking
                completedCount = 0;
                hasStartedPlaying = false;
                failedSet.clear();

                // Populate checking grid visual cards
                var grid = document.getElementById('overlay-server-grid');
                if (grid) {
                    grid.innerHTML = '';
                    streams.forEach(function(s, idx) {
                        var card = document.createElement('div');
                        card.className = 'server-card';
                        card.id = 'card-' + idx;
                        
                        var cleanName = String(s.title || s.name || 'Server').split('|')[0].trim();
                        card.innerHTML = '<svg class="check-icon" viewBox="0 0 24 24">' +
                                         '<path d="M20 6L9 17l-5-5" stroke="#2ecc71" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"></path>' +
                                         '</svg>' +
                                         '<span>' + cleanName + '</span>';
                        grid.appendChild(card);
                    });
                }
                
                document.getElementById('overlay-progress-fill').style.width = '0%';
                document.getElementById('overlay-analyzed').textContent = '0 ANALYZED';
                document.getElementById('overlay-remaining').textContent = streams.length + ' REMAINING';

                // Run concurrent preflight checks in one go (parallel)
                var checks = streams.map(function(s, i) {
                    var pUrl = getPlayableUrl(s);
                    return preflightCheck(pUrl, i);
                });

                // Rebuild dropdown with only valid streams when complete
                Promise.all(checks).then(function() {
                    var validStreams = streams.filter(function(s) { return s.isValidated; });
                    if (validStreams.length > 0) {
                        // Find playing index
                        var playingStream = streams[currentIdx];
                        var newIdx = validStreams.indexOf(playingStream);
                        if (newIdx === -1) newIdx = 0;
                        
                        streams = validStreams;
                        populateSelect(streams);
                        currentIdx = newIdx;
                        select.value = String(newIdx);
                        statusEl.textContent = streams.length + ' server(s) active';
                    } else {
                        // Fallback: keep all
                        populateSelect(streams);
                        statusEl.textContent = 'All validation failed. Reverting to all servers.';
                        if (!hasStartedPlaying) {
                            hasStartedPlaying = true;
                            currentIdx = 0;
                            select.value = '0';
                            playStream(streams[0]);
                            hideOverlay();
                        }
                    }
                });

            } catch (err) {
                console.error('[Player] loadStreams error:', err);
                loadText.textContent = 'Error loading from Nxsha. Retrying...';
                setTimeout(loadStreams, 4000);
            }
        }

        // Kick off loading streams
        loadStreams();
    </script>
</body>
</html>`;
}

module.exports = {
  renderPlayerPage,
  renderNxshaPlayerPage
};
