import { Db, IndexDescription, MongoClient, MongoServerError } from 'mongodb';
import mongoose from 'mongoose';
import { config } from '../config';

const client = new MongoClient(config.mongoUri, {
  appName: config.appName,
  maxPoolSize: 20,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  retryWrites: false,
});

let dbReady = false;
const dbMap: Record<string, Db> = {};
let connectOnce: Promise<Db> | null = null;

export function getAuthDb(): Db {
  const d = dbMap[config.authDbName];
  if (!d) throw new Error('Auth DB not ready; call connectDB() first');
  return d;
}
export function getCustomerDb(): Db {
  const d = dbMap[config.customerDbName];
  if (!d) throw new Error('Customer DB not ready; call connectDB() first');
  return d;
}

export async function connectDB(): Promise<Db> {
  if (dbReady) return getAuthDb();
  if (connectOnce) return connectOnce;

  connectOnce = (async () => {
    await client.connect();

    const authDb = client.db(config.authDbName);
    const customerDb = client.db(config.customerDbName);

    // Initialize Mongoose connection for models used elsewhere (e.g., conversations/messages)
    // Use the customer DB by default for those collections
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri, { dbName: config.customerDbName });
    }

    await ensureAuthIndexes(authDb);
    await ensureCustomerIndexes(customerDb);

    await authDb.command({ ping: 1 });
    await customerDb.command({ ping: 1 });

    dbMap[config.authDbName] = authDb;
    dbMap[config.customerDbName] = customerDb;
    dbReady = true;

    console.log(`✅ Connected DBs → auth="${config.authDbName}"  customer="${config.customerDbName}"`);
    return authDb;
  })();

  return connectOnce;
}

/* ---------- indexes ---------- */
async function safeEnsureIndex(
  d: Db,
  collection: string,
  keys: Record<string, 1 | -1>,
  options: Omit<IndexDescription, 'key'> & { name?: string } = {}
) {
  const coll = d.collection(collection);
  try {
    await coll.createIndex(keys, options);
  } catch (e: any) {
    const err = e as MongoServerError;
    if (err.code === 85) {
      const existing = (await coll.indexes()).find((i) => JSON.stringify(i.key) === JSON.stringify(keys));
      if (existing) {
        await coll.createIndex(keys, { ...options, name: existing.name });
        return;
      }
    }
    throw err;
  }
}

async function ensureAuthIndexes(d: Db) {
  // Drop legacy/incompatible unique indexes that enforce uniqueness on null/missing values
  // so that email/phone can truly be optional. We only keep indexes that have the
  // intended partialFilterExpression.
  const users = d.collection('users');
  const existing = await users.indexes();
  for (const idx of existing) {
    const keyStr = JSON.stringify(idx.key);
    const isEmailIdx = keyStr === JSON.stringify({ email: 1 });
    const isPhoneIdx = keyStr === JSON.stringify({ phone: 1 });
    if ((isEmailIdx || isPhoneIdx) && idx.unique) {
      const pfe: any = (idx as any).partialFilterExpression;
      const pfeOk = pfe && ((isEmailIdx && pfe.email && pfe.email.$type === 'string') || (isPhoneIdx && pfe.phone && pfe.phone.$type === 'string'));
      if (!pfeOk) {
        try {
          await users.dropIndex(idx.name);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(`Could not drop legacy index ${idx.name}:`, (e as Error).message);
        }
      }
    }
  }

  await safeEnsureIndex(d, 'users', { email: 1 }, {
    unique: true,
    name: 'email_unique_when_present',
    partialFilterExpression: { email: { $exists: true, $type: 'string' } },
  });
  await safeEnsureIndex(d, 'users', { phone: 1 }, {
    unique: true,
    name: 'phone_unique_when_present',
    partialFilterExpression: { phone: { $exists: true, $type: 'string' } },
  });
  await safeEnsureIndex(d, 'users', { username: 1 }, { name: 'username_idx' });
}

async function ensureCustomerIndexes(d: Db) {
  await safeEnsureIndex(d, 'assistrequests', { userId: 1 }, { name: 'userId_idx' });
  await safeEnsureIndex(d, 'assistrequests', { status: 1 }, { name: 'status_idx' });
  await safeEnsureIndex(d, 'assistrequests', { createdAt: -1 }, { name: 'createdAt_idx' });
}

// Kick off connection on import so server startup (importing this module) establishes DBs
// and the Mongoose default connection for models.
// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  try {
    await connectDB();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize database connections:', err);
  }
})();
