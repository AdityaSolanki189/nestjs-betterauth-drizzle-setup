import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './src/database/migrations',
  schema: './src/database/schema',
  dialect: 'postgresql',
  dbCredentials: {
    host:
      process.env.POSTGRES_HOST === 'postgres'
        ? 'localhost'
        : process.env.POSTGRES_HOST!,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB!,
    ssl: process.env.POSTGRES_SSL === 'true',
  },
});
