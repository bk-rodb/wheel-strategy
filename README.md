# Wheel Strategy Dashboard

React + Vite dashboard for tracking the options wheel (cash-secured put → stock → covered call), with a .NET analysis API for data-driven strike suggestions.

## Getting started

| Doc | When to read |
|-----|--------------|
| [docs/PRE_LAUNCH.md](docs/PRE_LAUNCH.md) | First time — requirements, install, `.env`, backend secrets |
| [docs/LAUNCH.md](docs/LAUNCH.md) | Every session — start frontend and analysis API |
| [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) | Roadmap and planned features |
| [CLAUDE.md](CLAUDE.md) | Architecture and agent/developer reference |

Quick run (after setup): `npm run dev` at repo root and `dotnet run` in `backend/WheelStrategy.Api`.
