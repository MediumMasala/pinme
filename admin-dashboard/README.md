# PinMe Admin Dashboard

A React + TypeScript + Tailwind dashboard for monitoring PinMe usage.

## Features

- **Real-time stats**: Users, messages, expenses overview
- **Expense breakdown**: By category with visual bars
- **Recent activity**: Users, conversations, expenses tables
- **Auto-refresh**: Click refresh to get latest data

## Setup

### Prerequisites

- Node.js 18+
- PinMe backend running (provides `/admin/dashboard` endpoint)

### Installation

```bash
cd admin-dashboard
npm install
```

### Development

```bash
# Set the API base URL (defaults to proxying /admin to localhost:3000)
VITE_API_BASE_URL=http://localhost:3000 npm run dev
```

The dashboard runs at `http://localhost:5173`

### Production Build

```bash
npm run build
```

Built files are in `dist/` folder.

### Serving from Backend

To serve the dashboard from the Node.js backend:

1. Build the dashboard: `npm run build`
2. Copy `dist/` contents to backend's `public/admin/` folder
3. Add to Express:

```typescript
import express from 'express';
import path from 'path';

// Serve admin dashboard
app.use('/admin-ui', express.static(path.join(__dirname, 'public/admin')));

// SPA fallback
app.get('/admin-ui/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `` (uses proxy in dev) |

## API Endpoint

The dashboard fetches data from:

```
GET /admin/dashboard
```

Response shape:
```json
{
  "success": true,
  "generatedAt": "2025-12-06T15:44:49.495Z",
  "overview": {
    "users": { "total": 1, "onboarded": 1, ... },
    "messages": { "total": 13, "inbound": 7, ... },
    "expenses": { "total": 2, "totalAmount": "2800", ... }
  },
  "expensesByCategory": [...],
  "recentUsers": [...],
  "recentConversations": [...],
  "recentExpenses": [...]
}
```
