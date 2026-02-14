# Stellar Sky - Virtual Planetarium

A WebGL-powered virtual planetarium that lets you explore the night sky from any location on Earth.

## Features

- **119,627 stars** from the HYG (Hipparcos, Yale, Gliese) stellar database
- **Location selection** - Pick any point on Earth to view the sky from
- **Real-time sky** - Stars rotate accurately based on your location and time
- **Time control** - View the sky at any date/time, or watch it live
- **Accurate colors** - Star colors derived from B-V color index (spectral type)
- **Magnitude-based rendering** - Brighter stars appear larger and more prominent

## Tech Stack

- React + TypeScript + Vite
- WebGL 2.0 for hardware-accelerated star rendering
- Perturbation-free celestial coordinate transforms
- HYG v4.1 star database

## Getting Started

```bash
npm install
npm run dev
```

## Star Data

Uses the [HYG Database](https://github.com/astronexus/HYG-Database) - a compilation of:
- Hipparcos Catalog (~118,000 stars)
- Yale Bright Star Catalog
- Gliese Catalog of Nearby Stars

## Controls

- **Drag** to look around the sky
- **Location picker** to change your viewing location
- **Time picker** to change date/time or enable live mode

## License

MIT
