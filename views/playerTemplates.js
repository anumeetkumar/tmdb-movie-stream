/**
 * Views Layer - Dynamic Player Layouts and Templates
 */

function renderPlayerPage(mediaTitle, mediaSubtitle, _streams, resolveUrl, posterUrl) {
  return `
    <!DOCTYPE html>
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
                width: 95%;
                max-width: 1100px;
                background: rgba(255, 255, 255, 0.03);
                backdrop-filter: blur(16px);
                border: 1px rgba(255, 255, 255, 0.08) solid;
                border-radius: 24px;
                padding: 24px;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                gap: 20px;
                animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px rgba(255, 255, 255, 0.08) solid;
                padding-bottom: 16px;
                flex-wrap: wrap;
                gap: 12px;
            }
            .title-area h1 {
                font-size: 24px;
                font-weight: 800;
                background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .title-area p {
                font-size: 14px;
                color: #8a99ad;
                margin-top: 4px;
            }
            .source-select-area {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .source-label {
                font-size: 13px;
                color: #8a99ad;
                font-weight: 600;
                white-space: nowrap;
            }
            .source-select {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #fff;
                padding: 8px 16px;
                border-radius: 12px;
                font-family: 'Outfit', sans-serif;
                font-size: 13px;
                font-weight: 600;
                outline: none;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                max-width: 280px;
            }
            .source-select:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.2);
            }
            .source-select option { background: #0f172a; color: #fff; }
            .player-wrapper {
                position: relative;
                width: 100%;
                aspect-ratio: 16/9;
                background: #000;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 30px rgba(0,0,0,0.4);
                border: 1px rgba(255, 255, 255, 0.05) solid;
            }
            #player { width: 100%; height: 100%; }

            /* Loading skeleton overlay */
            #loading-overlay {
                position: absolute;
                inset: 0;
                background: rgba(8, 12, 20, 0.92);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 20;
                gap: 16px;
                border-radius: 16px;
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
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 13px;
                color: #63758d;
                flex-wrap: wrap;
                gap: 10px;
            }
            .btn {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                border: none; color: #fff;
                padding: 10px 20px; border-radius: 12px;
                font-weight: 600; cursor: pointer;
                text-decoration: none; transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(79, 172, 254, 0.3);
            }
            .btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(79, 172, 254, 0.4); }
            .btn-secondary {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #ccc; box-shadow: none;
            }
            .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); color: #fff; box-shadow: none; }
            .controls-info { display: flex; gap: 15px; flex-wrap: wrap; }
            .stream-count { font-size: 12px; color: #3d5166; }
            #stream-status { font-size: 13px; font-weight: 600; color: #00f2fe; }
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
                        <option>Loading streams...</option>
                    </select>
                </div>
            </div>
            <div class="player-wrapper">
                <div id="player"></div>
                <div id="loading-overlay">
                    <div class="load-spinner"></div>
                    <div class="load-text" id="load-text">Fetching streams...</div>
                    <div class="load-subtext">Scraping providers in parallel</div>
                </div>
            </div>
            <div class="footer">
                <div class="controls-info">
                    <span>Space: Play/Pause</span>
                    <span>Double Click: Fullscreen</span>
                    <span id="stream-status"></span>
                </div>
                <div style="display:flex; gap:10px;">
                    <a class="btn btn-secondary" id="raw-links-btn" href="${resolveUrl}" target="_blank">Raw Links</a>
                    <button class="btn" onclick="location.reload()">Reload</button>
                </div>
            </div>
        </div>
        <script>
            const RESOLVE_URL = '${resolveUrl}';
            const POSTER = '${posterUrl}';

            const isHls = (url) => url && (url.includes('.m3u8') || url.includes('m3u8-proxy'));
            const overlay = document.getElementById('loading-overlay');
            const loadText = document.getElementById('load-text');
            const select = document.getElementById('source-select');
            const statusEl = document.getElementById('stream-status');

            let art = null;
            let streams = [];

            function initPlayer(stream) {
                if (art) {
                    art.switchUrl(stream.url).catch(() => {});
                    return;
                }
                art = new Artplayer({
                    container: '#player',
                    url: stream.url,
                    type: isHls(stream.url) ? 'm3u8' : 'video',
                    poster: POSTER,
                    customType: {
                        m3u8: function (video, url) {
                            if (Hls.isSupported()) {
                                const hls = new Hls({ enableWorker: true });
                                hls.loadSource(url);
                                hls.attachMedia(video);
                                video._hls = hls;
                            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                                video.src = url;
                            }
                        },
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

                // Auto try next source on error
                art.on('error', () => {
                    const idx = parseInt(select.value, 10);
                    if (idx < streams.length - 1) {
                        console.warn('[Player] Stream error, trying next source...');
                        select.value = idx + 1;
                        select.dispatchEvent(new Event('change'));
                    }
                });
            }

            function populateSelect(streamList) {
                select.innerHTML = '';
                streamList.forEach((s, idx) => {
                    const opt = document.createElement('option');
                    opt.value = idx;
                    opt.textContent = '[' + s.provider + '] ' + (s.name || s.title || 'Stream') + ' (' + (s.quality || 'Auto') + ')';
                    select.appendChild(opt);
                });
                select.disabled = false;
            }

            async function loadStreams() {
                loadText.textContent = 'Fetching streams...';
                try {
                    const res = await fetch(RESOLVE_URL, { cache: 'no-store' });
                    const data = await res.json();
                    streams = (data.streams || []).filter(s => s && s.url);

                    if (streams.length === 0) {
                        loadText.textContent = 'No streams found. Retrying...';
                        setTimeout(loadStreams, 4000);
                        return;
                    }

                    populateSelect(streams);
                    statusEl.textContent = streams.length + ' stream(s) loaded';

                    // Hide overlay and play first stream
                    overlay.classList.add('hidden');
                    setTimeout(() => overlay.style.display = 'none', 400);
                    initPlayer(streams[0]);

                } catch (err) {
                    loadText.textContent = 'Error fetching streams. Retrying...';
                    setTimeout(loadStreams, 4000);
                }
            }

            // Handle source switching
            select.addEventListener('change', (e) => {
                const idx = parseInt(e.target.value, 10);
                const stream = streams[idx];
                if (!stream) return;
                console.log('[Player] Switching to:', stream.provider, stream.url);
                if (art) {
                    const type = isHls(stream.url) ? 'm3u8' : 'video';
                    art.switchUrl(stream.url, type).then(() => art.play()).catch(() => {
                        art.url = stream.url;
                        art.type = type;
                        art.play();
                    });
                } else {
                    initPlayer(stream);
                }
            });

            // Start fetching immediately
            loadStreams();
        </script>
    </body>
    </html>
  `;
}

module.exports = { renderPlayerPage };
