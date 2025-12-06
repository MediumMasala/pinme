# PinMe - WhatsApp Expense Tracker

A WhatsApp-first personal expense tracker and bill-splitting assistant for Indian users. Built with Mastra AI at its core.

## Features

- **Expense Tracking**: Log expenses via text messages or receipt photos
- **Smart Parsing**: AI-powered extraction of amount, category, and description
- **Office Reimbursements**: Mark expenses as reimbursable with natural language
- **Bill Splitting**: Split large bills with friends (like a personal Splitwise)
- **Daily Summaries**: Automated expense summaries sent every night

## Tech Stack

- **Runtime**: Node.js (LTS)
- **Language**: TypeScript
- **Framework**: Express
- **AI Orchestration**: Mastra (`@mastra/core`)
- **Database**: PostgreSQL via Prisma
- **Messaging**: WhatsApp Cloud API

## Project Structure

```
pinme/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── server.ts              # Express app entry point
│   ├── config.ts              # Environment configuration
│   ├── db.ts                  # Prisma client
│   ├── whatsapp/
│   │   └── client.ts          # WhatsApp Cloud API adapter
│   ├── mastra/
│   │   ├── agent.ts           # PinMe Mastra agent
│   │   └── tools/             # AI-callable tools
│   │       ├── logExpenseTool.ts
│   │       ├── markReimbursementTool.ts
│   │       ├── splitBillTool.ts
│   │       ├── saveContactsTool.ts
│   │       ├── sendMessageTool.ts
│   │       ├── userTool.ts
│   │       └── parseReceiptTool.ts
│   ├── logic/                 # Pure business logic
│   │   ├── expenses.ts
│   │   ├── splits.ts
│   │   ├── summaries.ts
│   │   ├── contacts.ts
│   │   └── users.ts
│   ├── routes/
│   │   ├── whatsappWebhook.ts # WhatsApp webhook handler
│   │   └── admin.ts           # Admin endpoints
│   └── types/                 # TypeScript types
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+ (LTS)
- PostgreSQL database
- WhatsApp Business Account with Cloud API access
- OpenAI API key

### Installation

1. **Clone and install dependencies**
   ```bash
   cd pinme
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Set up database**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate:dev
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

### WhatsApp Configuration

1. Go to [Meta Developer Console](https://developers.facebook.com/)
2. Create a WhatsApp Business App
3. Get your:
   - **Access Token**: From App Dashboard > WhatsApp > API Setup
   - **Phone Number ID**: From the same page
   - **Verify Token**: Create your own for webhook verification

4. Configure Webhook:
   - URL: `https://your-domain.com/whatsapp/webhook`
   - Verify Token: Same as `WHATSAPP_VERIFY_TOKEN` in your `.env`
   - Subscribe to: `messages`

### Running in Production

```bash
npm run build
npm start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/whatsapp/webhook` | Webhook verification |
| POST | `/whatsapp/webhook` | Receive WhatsApp messages |
| POST | `/admin/run-daily-summaries` | Trigger daily summaries |
| POST | `/admin/send-summary/:phone` | Send summary to specific user |
| GET | `/admin/stats` | Get user statistics |

## Daily Summaries (Cron Setup)

Set up a cron job to hit the daily summary endpoint:

```bash
# Every day at 9 PM IST (3:30 PM UTC)
30 15 * * * curl -X POST https://your-domain.com/admin/run-daily-summaries -H "x-api-key: YOUR_ADMIN_KEY"
```

## User Flows

### Onboarding
1. User sends first message
2. PinMe responds with introduction
3. User provides their name
4. PinMe sends welcome message with instructions

### Logging Expenses
```
User: "Paid 500 rupees for dinner today"
PinMe: "Got it. Logged ₹500 for dinner as personal expense."
```

### Receipt Images
```
User: [Sends bill photo]
PinMe: "Scanned your bill from Restaurant. Logged ₹1200 under Food. Reply 'edit' if I got something wrong."
```

### Marking Reimbursements
```
User: "Mark this as office reimbursement"
PinMe: "Marked 1 expense as office reimbursement."
```

### Bill Splitting
```
PinMe: "Big feast! This looks like a food bill of ₹3000. Do you want to split it with your friends?"
User: "Yes"
PinMe: "Share up to 4 phone numbers of friends..."
User: "Rahul - 9876543210, Priya - 9123456789"
PinMe: "Split created! I've sent payment requests to Rahul and Priya for ₹1000 each."
```

## Architecture

The system uses **Mastra** as the central AI orchestrator:

```
WhatsApp Webhook → Normalize Message → Mastra Agent → Tool Calls → DB/WhatsApp
```

- **Agent**: Handles all intent detection, parsing, and decision-making
- **Tools**: Thin wrappers around DB operations and WhatsApp API
- **Logic**: Pure functions for business rules (no AI)

## Development

```bash
# Type check
npm run typecheck

# Open Prisma Studio (DB GUI)
npm run prisma:studio

# Run migrations
npm run prisma:migrate:dev
```

## TODO

- [ ] Integrate real OCR for receipt parsing (Google Vision / AWS Textract)
- [ ] Add conversation context/memory for multi-turn flows
- [ ] Implement edit expense flow
- [ ] Add expense categories customization
- [ ] Build admin dashboard

## License

Private - All rights reserved
