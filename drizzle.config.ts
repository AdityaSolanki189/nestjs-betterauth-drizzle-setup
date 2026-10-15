import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { z } from 'zod';

const databaseUrl = z.url({ protocol: /^postgres(ql)?$/ }).safeParse(process.env.DATABASE_URL);
if (!databaseUrl.success) throw new Error('Invalid environment: DATABASE_URL');

export default defineConfig({
  out: './src/database/migrations',
  schema: './src/database/schema',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl.data,
  },
});
