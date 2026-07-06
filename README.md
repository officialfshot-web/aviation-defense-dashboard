# Aviation Defense Dashboard

Real-time C-UAS / base security tactical dashboard with live aircraft tracking, geofencing, threat scoring, and incident alerts on an interactive map.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/officialfshot-web/aviation-defense-dashboard&env=DATABASE_URL)

Built with Next.js, TypeScript, Tailwind CSS, Prisma, and Leaflet.

## Features

- Live aircraft feed with real-time positions, altitude, speed, and heading
- Interactive tactical map with multiple basemap layers
- Custom geofences and point-of-interest markers
- Automated threat detection and scoring
- Alert panel with acknowledge / clear actions
- Aircraft detail panel with photos and classification data
- Incident report export

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file and set up the database:

```bash
cp .env.example .env
npx prisma migrate dev
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

- `npm run dev` — start the development server
- `npm run build` — build for production
- `npm run start` — start the production server
- `npm run lint` — run ESLint

## License

MIT
