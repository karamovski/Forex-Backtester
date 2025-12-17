# Forex Signal Backtesting Software

## Overview

This is a professional forex signal backtesting application that allows traders to test trading signals against historical tick data. The software enables users to configure data formats, parse trading signals, define strategy rules (stop-loss management, take-profit handling), set risk parameters, and run backtests to evaluate trading performance.

The application follows a multi-step workflow: Data Setup → Signal Configuration → Strategy Settings → Risk Management → Backtest Execution → Results Analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: Zustand for global backtest state (`backtest-store.ts`)
- **Data Fetching**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Structure**: RESTful endpoints under `/api/` prefix
- **Key Endpoint**: `POST /api/backtest/run` - executes the backtesting engine

### Data Layer
- **Schema Definition**: Zod schemas in `shared/schema.ts` for type validation
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Current Storage**: In-memory storage (`MemStorage` class) for user data
- **Database Config**: Drizzle config ready for PostgreSQL when DATABASE_URL is provided

### Key Design Patterns
- **Shared Types**: Common schemas in `shared/` directory used by both client and server
- **Path Aliases**: `@/` for client source, `@shared/` for shared code
- **Component Structure**: UI primitives in `components/ui/`, application components at `components/` root
- **Page-based Organization**: Each workflow step has its own page component in `pages/`

### Backtesting Engine
Located in `server/backtest-engine.ts`, handles:
- Tick data processing with configurable formats
- Signal parsing and matching
- Trade simulation with SL/TP management
- Position sizing based on risk rules
- Results aggregation and statistics

## External Dependencies

### Database
- **PostgreSQL**: Configured via Drizzle ORM, requires `DATABASE_URL` environment variable
- **Session Store**: `connect-pg-simple` for PostgreSQL-backed sessions

### UI Framework Dependencies
- **Radix UI**: Full suite of accessible primitives (dialog, dropdown, tabs, etc.)
- **Recharts**: Charting library for results visualization
- **embla-carousel-react**: Carousel functionality
- **react-day-picker**: Date picker component
- **vaul**: Drawer component

### Data Processing
- **Zod**: Schema validation for API requests and data structures
- **date-fns**: Date manipulation utilities
- **papaparse**: CSV parsing (types included)

### Build & Development
- **Vite**: Development server and production bundler
- **esbuild**: Server-side bundling for production
- **tsx**: TypeScript execution for development