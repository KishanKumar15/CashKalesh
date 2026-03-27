# CashKalesh

CashKalesh is a full-stack personal finance tracker with a modern dashboard, fast transaction capture, budgeting, goals, recurring planning, reports, and shared account workflows.

## Features

- Secure authentication (email/password + Google sign-in support)
- Dashboard with balance, category spend, forecast, and insights
- Transaction manager with filters, tags, transfers, and split transaction modal
- Quick Add palette for keyboard-first transaction entry
- Account and category management
- Monthly budgets with health tracking
- Savings goals with contribution/withdrawal tracking
- Recurring income/expense scheduling
- Reports with CSV/PDF export and forecast explorer
- Notifications and rule-based insights
- Profile and workspace preferences

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: ASP.NET Core 8 Web API
- Database: PostgreSQL + EF Core
- Charts: Recharts
- Tests: Vitest (frontend), xUnit (backend)

## Local Development

### 1) Backend

```powershell
dotnet restore backend/src/PersonalFinanceTracker.Api/PersonalFinanceTracker.Api.csproj
dotnet run --project backend/src/PersonalFinanceTracker.Api/PersonalFinanceTracker.Api.csproj --urls http://localhost:5080
```

### 2) Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` and API at `http://localhost:5080`.

## Build

### Backend

```powershell
dotnet build backend/src/PersonalFinanceTracker.Api/PersonalFinanceTracker.Api.csproj
```

### Frontend

```powershell
cd frontend
npm run build
```

## Test

### Backend

```powershell
dotnet test backend/tests/PersonalFinanceTracker.Api.Tests/PersonalFinanceTracker.Api.Tests.csproj
```

### Frontend

```powershell
cd frontend
npm run test
```

## Deployment

### Containerized (recommended)

```powershell
podman compose -f podman-compose.yaml up --build -d
```

Services:

- Frontend: `http://localhost:5173`
- API: `http://localhost:5080`
- PostgreSQL: `localhost:5432`

### Manual deployment outline

1. Build frontend (`npm run build`) and serve `frontend/dist` via Nginx (or static host).
2. Publish backend with `dotnet publish` and run behind a reverse proxy.
3. Configure production environment variables for API, DB, JWT, SMTP, and Google auth.
4. Point frontend API base URL to deployed backend.
