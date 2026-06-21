# Graph Report - .  (2026-06-21)

## Corpus Check
- Corpus is ~20,031 words - fits in a single context window. You may not need a graph.

## Summary
- 381 nodes · 615 edges · 31 communities (20 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Account & Position UI|Account & Position UI]]
- [[_COMMUNITY_Alpaca API Client & Types|Alpaca API Client & Types]]
- [[_COMMUNITY_Wheel Analysis Data Flow|Wheel Analysis Data Flow]]
- [[_COMMUNITY_NPM Dependencies|NPM Dependencies]]
- [[_COMMUNITY_Analysis Panel & Fetch|Analysis Panel & Fetch]]
- [[_COMMUNITY_Wheel Dashboard Root|Wheel Dashboard Root]]
- [[_COMMUNITY_TS App Config|TS App Config]]
- [[_COMMUNITY_TS Node Config|TS Node Config]]
- [[_COMMUNITY_Wheel Analysis Service|Wheel Analysis Service]]
- [[_COMMUNITY_Alpaca Market Data Client|Alpaca Market Data Client]]
- [[_COMMUNITY_Black-Scholes Stat Math|Black-Scholes Stat Math]]
- [[_COMMUNITY_Bar Cache Service|Bar Cache Service]]
- [[_COMMUNITY_Launch Settings|Launch Settings]]
- [[_COMMUNITY_.NET Project & EF Core|.NET Project & EF Core]]
- [[_COMMUNITY_Alpaca Bar DTOs|Alpaca Bar DTOs]]
- [[_COMMUNITY_EF Core DbContext|EF Core DbContext]]
- [[_COMMUNITY_Analysis API Endpoints|Analysis API Endpoints]]
- [[_COMMUNITY_Alpaca Options Config|Alpaca Options Config]]
- [[_COMMUNITY_Analysis Options Config|Analysis Options Config]]
- [[_COMMUNITY_Vite Env Types|Vite Env Types]]
- [[_COMMUNITY_TSConfig Root|TSConfig Root]]
- [[_COMMUNITY_BrokerAccount Model|BrokerAccount Model]]
- [[_COMMUNITY_HistoricalBar Model|HistoricalBar Model]]
- [[_COMMUNITY_OptionLeg Model|OptionLeg Model]]
- [[_COMMUNITY_Position Model|Position Model]]
- [[_COMMUNITY_PriceSnapshot Model|PriceSnapshot Model]]
- [[_COMMUNITY_WatchlistItem Model|WatchlistItem Model]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 19 edges
2. `compilerOptions` - 16 edges
3. `StatMath` - 12 edges
4. `WheelPosition` - 10 edges
5. `fmt` - 10 edges
6. `BrokerType` - 9 edges
7. `WheelAnalysisService` - 8 edges
8. `PricePoint` - 7 edges
9. `AnalysisGranularity` - 7 edges
10. `http` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Wheel Strategy Dashboard (README overview)` --references--> `Wheel Strategy Dashboard (App)`  [INFERRED]
  README.md → CLAUDE.md
- `Daily-granularity toggle (planned)` --references--> `GET /api/analysis/wheel`  [EXTRACTED]
  docs/NEXT_STEPS.md → CLAUDE.md
- `Convert EnsureCreated to EF migrations` --references--> `HistoricalBar (SQLite cache)`  [INFERRED]
  docs/NEXT_STEPS.md → CLAUDE.md
- `Live option-chain integration (planned)` --references--> `Black-Scholes assignment probability`  [EXTRACTED]
  docs/NEXT_STEPS.md → CLAUDE.md
- `src/main.tsx entry script` --references--> `src/WheelDashboard.tsx (live entry)`  [INFERRED]
  index.html → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Wheel analysis request flow (UI to Alpaca)** — claude_md_fetch_wheel_analysis_ts, claude_md_wheel_analysis_endpoint, claude_md_wheel_analysis_service, claude_md_bar_cache_service, claude_md_alpaca_market_data_client [EXTRACTED 0.90]
- **Strike suggestion dual-probability model** — claude_md_wheel_analysis_service, claude_md_empirical_assignment_probability, claude_md_black_scholes_assignment_probability, claude_md_stat_math [INFERRED 0.85]
- **Local setup: frontend, backend, env config** — pre_launch_frontend_env, pre_launch_backend_user_secrets, launch_npm_run_dev, launch_dotnet_run [EXTRACTED 0.85]

## Communities (31 total, 11 thin omitted)

### Community 0 - "Account & Position UI"
Cohesion: 0.08
Nodes (41): fetchAlpacaAccount(), AccountHeader(), AccountPicker(), AccountPickerProps, OptionCard(), PriceTrendChart(), Sparkline(), StatRow() (+33 more)

### Community 1 - "Alpaca API Client & Types"
Cohesion: 0.07
Nodes (37): authHeaders(), get(), marketData, trading, AlpacaAccount, AlpacaBar, AlpacaBarsResponse, AlpacaPosition (+29 more)

### Community 2 - "Wheel Analysis Data Flow"
Cohesion: 0.07
Nodes (36): src/api/alpacaClient.ts, AlpacaMarketDataClient (backend), Alpaca GET no Content-Type (CORS gotcha), WheelStrategy.Api (.NET 10 Analysis Backend), BarCacheService, Black-Scholes assignment probability, Empirical assignment probability, src/api/fetchWheelAnalysis.ts (+28 more)

### Community 3 - "NPM Dependencies"
Cohesion: 0.08
Nodes (25): dependencies, react, react-dom, recharts, devDependencies, jsdom, @testing-library/jest-dom, @testing-library/react (+17 more)

### Community 4 - "Analysis Panel & Fetch"
Cohesion: 0.17
Nodes (15): fetchWheelAnalysis(), WheelAnalysisParams, DTE_CHOICES, GRANULARITY_CHOICES, gridRow(), LEVEL_COLOR, SideCard(), WheelAnalysisPanel() (+7 more)

### Community 5 - "Wheel Dashboard Root"
Cohesion: 0.11
Nodes (16): DataSource, dayChange(), dayChangePct(), dte(), fmt, MOCK_POSITIONS, OptionCard(), OptionLeg (+8 more)

### Community 6 - "TS App Config"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+12 more)

### Community 7 - "TS Node Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 8 - "Wheel Analysis Service"
Cohesion: 0.24
Nodes (9): AnalysisOptions, AnalysisRequest, CancellationToken, DateTimeOffset, List, Task, IWheelAnalysisService, WheelAnalysisService (+1 more)

### Community 9 - "Alpaca Market Data Client"
Cohesion: 0.17
Nodes (11): AlpacaMarketDataClient, AlpacaBarDto, AlpacaOptions, asOf, BarTimeframe, CancellationToken, DateOnly, DateTimeOffset (+3 more)

### Community 10 - "Black-Scholes Stat Math"
Cohesion: 0.25
Nodes (3): IReadOnlyList, BlackScholes, StatMath

### Community 11 - "Bar Cache Service"
Cohesion: 0.27
Nodes (9): BarTimeframe, CancellationToken, DateOnly, IReadOnlyList, string, Task, HistoricalBar, BarCacheService (+1 more)

### Community 12 - "Launch Settings"
Cohesion: 0.20
Nodes (9): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, profiles, http (+1 more)

### Community 13 - ".NET Project & EF Core"
Cohesion: 0.29
Nodes (6): net10.0, Microsoft.EntityFrameworkCore (9.*), Microsoft.EntityFrameworkCore.Sqlite (9.*), Microsoft.EntityFrameworkCore.SqlServer (9.*), Microsoft.EntityFrameworkCore.Tools (9.*), Microsoft.NET.Sdk.Web

### Community 14 - "Alpaca Bar DTOs"
Cohesion: 0.40
Nodes (4): AlpacaBarDto, AlpacaBarsResponseDto, AlpacaSnapshotDto, AlpacaTradeDto

### Community 15 - "EF Core DbContext"
Cohesion: 0.40
Nodes (3): WheelStrategyDbContext, DbContext, ModelBuilder

## Knowledge Gaps
- **126 isolated node(s):** `WheelPhase`, `DataSource`, `OptionLeg`, `PricePoint`, `WheelPosition` (+121 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fmt` connect `Account & Position UI` to `Alpaca API Client & Types`, `Analysis Panel & Fetch`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `WheelPosition` connect `Account & Position UI` to `Alpaca API Client & Types`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `WheelPhase`, `DataSource`, `OptionLeg` to the rest of the system?**
  _126 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Account & Position UI` be split into smaller, more focused modules?**
  _Cohesion score 0.08382936507936507 - nodes in this community are weakly interconnected._
- **Should `Alpaca API Client & Types` be split into smaller, more focused modules?**
  _Cohesion score 0.06821480406386067 - nodes in this community are weakly interconnected._
- **Should `Wheel Analysis Data Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.0746031746031746 - nodes in this community are weakly interconnected._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._