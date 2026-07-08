# ⚡ High-Performance TMDB Embed Player & Resolver API

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-success?logo=vercel&logoColor=white&style=flat-square)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![NodeJS Version](https://img.shields.io/badge/Node.js-20+-68a063?logo=node.js&logoColor=white&style=flat-square)](https://nodejs.org)

An ultra-fast, ad-free streaming player and resolver API for movies and TV shows using TMDB IDs. Engineered with **Dual-Phase Stream Resolution** for instant load times under **500ms** and dynamic background source merging.

---

## ✨ Features

- **⚡ Dual-Phase Loading Engine:** 
  - Plays the direct Vidzee Hindi (`sr=7`) stream instantly (<500ms) with zero local proxy overhead.
  - Concurrently queries and verifies all other providers in the background, updating the dropdown automatically.
- **🛡️ Ad-Free Playback Core:** Built-in sandboxed player elements strip third-party pop-up loaders, tracker scripts, and redirects.
- **🔗 Smart Proxy Wrapping:** Auto-identifies clean CDNs (like `img1.fvncw.com`) to stream them unproxied for high speeds, while safely proxy-mapping restrictive domains.
- **🎨 Glassmorphic Embed Mode:** Detects iframe environments and stretches to full viewport, converting player controls into an elegant floating pill that fades out when active.
- **📁 Positional & Query-String TV Routes:** Supports both `/embed/tv/{id}/{s}/{e}` and `/embed/tv/{id}?s={s}&e={e}` with built-in auto-correction for typos.

---

## 🚀 Iframe Embed API

Simply embed the player inside any standard HTML frame using these clean routes:

### Movies
```html
<iframe src="https://your-domain.com/embed/movie/{tmdb_id}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>
```

### TV Series Episodes
```html
<iframe src="https://your-domain.com/embed/tv/{tmdb_id}/{season}/{episode}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>
```
*Also supports query coordinates:* `/embed/tv/{tmdb_id}?s={season}&e={episode}`

---

## 📡 REST JSON Resolvers

For platforms utilizing custom players (VideoJS, Plyr, JWPlayer etc.), resolve streams directly:

### 1. Fast Stream API (Vidzee Hindi Direct)
- **Endpoint:** `GET /api/stream-fast/:type/:id`
- **Latency:** ~490ms (Repeats are cached)
- **Response:**
```json
{
  "success": true,
  "tmdbId": "155",
  "provider": "Vidzee",
  "server": "Hindi (sr=7)",
  "url": "https://img1.fvncw.com/hls_mps/19711468df4078c930e6ea1202b8f4ee16db6d08/720/index_310.m3u8?auth_key=...",
  "subtitles": []
}
```
*Pass `?redirect=true` to automatically redirect (302) to the direct HLS url.*

### 2. Multi-Provider Racer API (Full Search)
- **Endpoint:** `GET /api/resolve-all/:type/:id`
- **Latency:** ~5s (Concurrent racer lookup)
- **Response:**
```json
{
  "success": true,
  "tmdbId": "155",
  "count": 3,
  "streams": [
    {
      "name": "Vidzee Hindi",
      "title": "Vidzee Hindi [Hindi]",
      "url": "https://img1.fvncw.com/hls_mps/...index_310.m3u8?auth_key=...",
      "quality": "Auto",
      "provider": "Vidzee",
      "subtitles": []
    },
    {
      "name": "DahmerMovies",
      "title": "2160p | English | 7.7 GB | MKV | The Dark Knight 2008 2160p HDR10 UHD...",
      "url": "https://p.111477.xyz/bulk?u=https://...",
      "quality": "2160p",
      "provider": "DahmerMovies"
    }
  ]
}
```

---

## 🛠️ Local Development

### 1. Configure Environment
Create a `.env` file in the root directory:
```env
PORT=8788
TMDB_API_KEY=your_tmdb_api_key
# Optional: comma-separated tmdb keys for high volume rotate-balancing
TMDB_API_KEYS=key1,key2,key3 
```

### 2. Run the App
```bash
npm install
npm run dev
```
Open `http://localhost:8788` to access the interactive generator dashboard.

---

## ☁️ Vercel Deployment

Deploy in seconds utilizing serverless functions:

```bash
vercel
```

Make sure to configure `TMDB_API_KEY` inside your Vercel Project Settings environment variables.

---

## ⚖️ License
Licensed under the [MIT License](LICENSE.md).
