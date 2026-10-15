import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { validateEnvironment } from './src/config/env.js';
import * as schema from './src/database/schema/index.js';
import { createAuth } from './src/lib/auth.js';

// Schema generation constructs a lazy client; it does not connect or start Nest.
const config = validateEnvironment(process.env);
const db = drizzle(postgres(config.DATABASE_URL), { schema });
export const auth = createAuth(config, db);
