# ✈️ Aviation Defense Dashboard

**Real-time C-UAS / base security tactical dashboard.**
Track live aircraft, draw geofences, score threats, and manage alerts on an interactive military-style map.

<p align="center">
  <a href="https://aviation-defense-dashboard.vercel.app/" target="_blank">
    <img src="https://img.shields.io/badge/🚀_LIVE_DEMO-Click_to_Launch-00C7B7?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white" alt="Leaflet" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## 🎯 What it does

- 🛩️ **Live aircraft feed** — real-time positions, altitude, speed, heading, and callsign data
- 🗺️ **Interactive tactical map** — dark, satellite, street, and terrain basemap layers
- 🚧 **Custom geofences & POIs** — draw restricted zones and drop points of interest with a click
- ⚠️ **Automated threat detection** — threat scoring, predicted paths, and severity-based alerts
- 🔔 **Alert panel** — acknowledge, clear, and export incidents
- 📸 **Aircraft detail cards** — photos, classification, registration, operator, and nearest airport info
- 📄 **Incident report export** — download JSON reports for post-event analysis

## 🚀 Try it live

**👉 [https://aviation-defense-dashboard.vercel.app/](https://aviation-defense-dashboard.vercel.app/)**

No install required — open the link and watch the sector in real time.

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org/) + React 19 |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Database | [Prisma](https://www.prisma.io/) + SQLite |
| Map | [Leaflet](https://leafletjs.com/) + [React Leaflet](https://react-leaflet.js.org/) |
| Aircraft Data | [ADSB.lol](https://adsb.lol/) API |

## 🏃 Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/officialfshot-web/aviation-defense-dashboard.git
cd aviation-defense-dashboard

# 2. Install dependencies
npm install

# 3. Set up the environment and database
cp .env.example .env
npx prisma migrate dev

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/officialfshot-web/aviation-defense-dashboard&env=DATABASE_URL)

Set `DATABASE_URL` during setup. For a quick demo, use `file:/tmp/dev.db` (alerts won't persist between restarts). For production, use Vercel Postgres or a managed database.

## 📜 License

[MIT](./LICENSE)
