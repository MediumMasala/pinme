import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const config = {
  // Server
  port: parseInt(optionalEnv('PORT', '3000'), 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),

  // WhatsApp Cloud API
  whatsapp: {
    token: requireEnv('WHATSAPP_TOKEN'),
    phoneNumberId: requireEnv('WHATSAPP_PHONE_NUMBER_ID'),
    verifyToken: optionalEnv('WHATSAPP_VERIFY_TOKEN', 'pinme-verify-token'),
    apiVersion: optionalEnv('WHATSAPP_API_VERSION', 'v21.0'),
  },

  // OpenAI (for Mastra)
  openai: {
    apiKey: requireEnv('OPENAI_API_KEY'),
    model: optionalEnv('OPENAI_MODEL', 'gpt-4o-mini'),
  },

  // Business rules
  business: {
    splitThresholdAmount: parseInt(optionalEnv('SPLIT_THRESHOLD_AMOUNT', '2000'), 10),
    defaultTimezone: 'Asia/Kolkata',
    defaultCurrency: 'INR',
  },

  // Admin
  admin: {
    apiKey: optionalEnv('ADMIN_API_KEY', ''),
  },

  // GIPHY (for fun GIFs)
  giphy: {
    apiKey: optionalEnv('GIPHY_API_KEY', ''),
  },

  // Ledger Module
  ledger: {
    jwtSecret: optionalEnv('LEDGER_JWT_SECRET', 'pinme-ledger-secret-change-in-prod'),
    jwtExpiryDays: parseInt(optionalEnv('LEDGER_JWT_EXPIRY_DAYS', '7'), 10),
    baseUrl: optionalEnv('LEDGER_BASE_URL', 'https://pinme.onrender.com'),
  },
} as const;

export type Config = typeof config;
