# Wheel Strategy Desk

An options **trading desk** — currently focused on the wheel strategy (cash-secured put → stock → covered call). A React + Vite front end that tracks the wheel, surfaces data-driven strike suggestions from a .NET analysis API, and **places live/paper option orders** through Alpaca (fetch the next-Friday chain, snap to listed strikes, sell-to-open, and manage the working order).

## Getting started

| Doc | When to read |
|-----|--------------|
| [docs/PRE_LAUNCH.md](docs/PRE_LAUNCH.md) | First time — requirements, install, `.env`, backend secrets |
| [docs/LAUNCH.md](docs/LAUNCH.md) | Every session — start frontend and analysis API |
| [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) | Roadmap and planned features |
| [CLAUDE.md](CLAUDE.md) | Architecture and agent/developer reference |

Quick run (after setup): `npm run dev` at repo root and `dotnet run` in `backend/WheelStrategy.Api`.
