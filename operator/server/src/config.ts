import 'dotenv/config';

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  mongoUri: must('MONGODB_URI'),

  // Auth DB (users)
  authDbName: process.env.DB_AUTH_NAME || process.env.DB_NAME || 'appdb',

  // Customer DB (assistrequests, conversations, messages, conversationmetas)
  // IMPORTANT: default to the same DB (appdb) unless explicitly split via env
  customerDbName:
    process.env.DB_CUSTOMER_NAME ||
    process.env.DB_NAME ||
    process.env.DB_AUTH_NAME ||
    'customer',

  appName: process.env.APP_NAME || 'Server',
  jwtSecret: must('JWT_SECRET'),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:19006',

  // 👇 NEW: ORS routing
  orsApiKey: must('ORS_API_KEY'),
};
