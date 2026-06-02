# SafeRoute AI — Nagpur Intelligent Grid

A full-featured React + Vite UI for AI-powered safe routing in Nagpur.

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/` | Animated login with live hazard widgets |
| Register | `/register` | Driver registration with feature panels |
| Map | `/map` | Interactive hotspot map + live incident feed |
| Navigate | `/navigate` | AI route planner with turn-by-turn |
| Risk Analysis | `/risk` | Hazard charts, radar, hotspot table |
| Leaderboard | `/leaderboard` | Driver rankings + podium + stats |
| Admin | `/admin` | Full analytics dashboard with charts |

## Setup

```bash
npm install
npm run dev
```

## Stack

- **React 18** + **Vite 5**
- **Recharts** — AreaChart, BarChart, PieChart, RadarChart
- **Lucide React** — icons
- **JetBrains Mono** + **Syne** fonts (Google Fonts)
- Pure CSS design system (no Tailwind) with CSS variables

## Design System

- Theme: Dark cyber-grid (`#080c0e` base)
- Accent: `#00e5a0` (teal/green)
- Monospace: JetBrains Mono
- Display: Syne
- All design tokens in `src/index.css` as CSS variables

## Features

- ✅ Login & Register pages with split layout
- ✅ Persistent Navbar + Sidebar layout
- ✅ Interactive map with hotspot markers
- ✅ AI route planner with safety scores
- ✅ Risk analysis with charts + radar
- ✅ Driver leaderboard with podium
- ✅ Admin analytics dashboard (stats, charts, donut, grid map)
- ✅ Live alerts, pagination, search
- ✅ Fully responsive
