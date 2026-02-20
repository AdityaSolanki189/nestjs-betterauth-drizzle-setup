import { stripe } from '@better-auth/stripe';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import {
  admin,
  jwt,
  openAPI,
  organization,
  twoFactor,
} from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import Stripe from 'stripe';
import * as schema from '../database/schema';

export const db = drizzle({ client: postgres(process.env.DATABASE_URL!) });

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin({
      adminRoles: ['admin', 'superAdmin'],
    }),
    organization(),
    twoFactor(),
    jwt(),
    openAPI(),
    stripe({
      stripeClient,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [],
      },
    }),
  ],
});
