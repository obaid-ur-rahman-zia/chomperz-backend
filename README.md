# Chomperz Backend

Express API — game logic, MongoDB, Twitter OAuth, wallet/NFT sync.

## Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and keys

npm install
npm run dev
```

API runs at http://localhost:3001

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |
| `npm run smoke:economy` | Test economy math |

## Health check

```
GET http://localhost:3001/api/health
```
