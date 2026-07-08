/**
 * Views Layer - Dynamic Player Layouts and Templates
 */

function renderLoadingPage(mediaTitle) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Loading Stream... - ${mediaTitle}</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Outfit', sans-serif;
          background: radial-gradient(circle at center, #111b2d 0%, #080c14 100%);
          color: #fff;
          height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          margin: 0;
        }
        .card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(16px);
          border: 1px rgba(255, 255, 255, 0.08) solid;
          padding: 40px;
          border-radius: 24px;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          max-width: 500px;
        }
        h2 { font-weight: 800; margin-bottom: 12px; color: #00f2fe; }
        p { color: #8a99ad; margin-bottom: 24px; font-size: 15px; line-height: 1.5; }
        .spinner {
          border: 4px solid rgba(255,255,255,0.1);
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border-left-color: #00f2fe;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .btn {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          border: none;
          color: #fff;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          box-shadow: 0 4px 15px rgba(79, 172, 254, 0.3);
        }
      </style>
      <script>
        // Auto refresh page after 4.5 seconds to check scraper progress
        setTimeout(() => location.reload(), 4500);
      </script>
    </head>
    <body>
      <div class="card">
        <div class="spinner"></div>
        <h2>Resolving Video Streams</h2>
        <p>We are concurrently scraping and validating the fastest stream links for <b>${mediaTitle}</b>. This usually takes 3 to 6 seconds on first load.</p>
        <p style="font-size:12px; color:#556880;">Page will automatically reload to play once ready.</p>
        <button class="btn" onclick="location.reload()">Manual Check</button>
      </div>
    </body>
    </html>
  `;
}

function renderPlayerPage(mediaTitle, mediaSubtitle, streams, rawLinksUrl) {
  const defaultStream = streams[0];
  
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
            .source-select option {
                background: #0f172a;
                color: #fff;
            }
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
            #player {
                width: 100%;
                height: 100%;
            }
            .footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 13px;
                color: #63758d;
            }
            .btn {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                border: none;
                color: #fff;
                padding: 10px 20px;
                border-radius: 12px;
                font-weight: 600;
                cursor: pointer;
                text-decoration: none;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(79, 172, 254, 0.3);
            }
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(79, 172, 254, 0.4);
            }
            .btn-secondary {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #ccc;
                box-shadow: none;
            }
            .btn-secondary:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
                box-shadow: none;
            }
            .controls-info {
                display: flex;
                gap: 15px;
            }
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
                    <select id="source-select" class="source-select">
                        ${streams.map((s, idx) => `
                            <option value="${idx}">[${s.provider}] ${s.name} (${s.quality})</option>
                        `).join('')}
                    </select>
                </div>
            </div>
            <div class="player-wrapper">
                <div id="player"></div>
            </div>
            <div class="footer">
                <div class="controls-info">
                    <span>Space: Play/Pause</span>
                    <span>Double Click: Fullscreen</span>
                    <span>Supports casting</span>
                </div>
                <div style="display:flex; gap:10px;">
                    <a class="btn btn-secondary" href="${rawLinksUrl}" target="_blank">Raw Links</a>
                    <button class="btn" onclick="location.reload()">Reload</button>
                </div>
            </div>
        </div>
        <script>
            const streams = ${JSON.stringify(streams)};
            const select = document.getElementById('source-select');
            
            const isHls = (url) => url.includes('.m3u8') || url.includes('m3u8-proxy');

            // Initialize player with the first stream source
            const art = new Artplayer({
                container: '#player',
                url: streams[0].url,
                type: isHls(streams[0].url) ? 'm3u8' : 'video',
                customType: {
                    m3u8: function (video, url) {
                        if (Hls.isSupported()) {
                            const hls = new Hls();
                            hls.loadSource(url);
                            hls.attachMedia(video);
                        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            video.src = url;
                        }
                    },
                },
                volume: 0.8,
                isLive: false,
                muted: false,
                autoplay: true,
                pip: true,
                autoSize: true,
                autoMini: true,
                screenshot: true,
                setting: true,
                loop: false,
                flip: true,
                playbackRate: true,
                aspectRatio: true,
                fullscreen: true,
                fullscreenWeb: true,
                subtitleOffset: true,
                miniProgressBar: true,
                mutex: true,
                backdrop: true,
                playsInline: true,
                autoPlayback: true,
                airplay: true,
                theme: '#00f2fe',
                moreVideoAttr: {
                    crossOrigin: 'anonymous',
                }
            });

            // Handle dynamic source switching on select change
            select.addEventListener('change', (e) => {
                const index = parseInt(e.target.value, 10);
                const stream = streams[index];
                if (stream) {
                    console.log('Switching stream to:', stream.provider, stream.url);
                    const type = isHls(stream.url) ? 'm3u8' : 'video';
                    
                    // Switch ArtPlayer source URL dynamically
                    art.switchUrl(stream.url).then(() => {
                        art.play();
                    }).catch(() => {
                        // Fallback re-init
                        art.url = stream.url;
                        art.type = type;
                        art.play();
                    });
                }
            });
        </script>
    </body>
    </html>
  `;
}

module.exports = {
  renderLoadingPage,
  renderPlayerPage
};
