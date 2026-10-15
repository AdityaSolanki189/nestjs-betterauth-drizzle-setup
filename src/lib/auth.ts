import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, jwt, openAPI, organization, twoFactor } from 'better-auth/plugins';
import { adminAc, userAc } from 'better-auth/plugins/admin/access';
import { Logger } from '@nestjs/common';
import type { Environment } from '../config/env.js';
import type { Database } from '../drizzle/drizzle.module.js';
import * as schema from '../database/schema/index.js';

export function createAuth(config: Environment, db: Database) {
  const logger = new Logger('Authentication');
  return betterAuth({
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    logger: {
      level: 'warn',
      log(level) {
        if (level === 'error') logger.error('Authentication operation failed');
        else if (level === 'warn') logger.warn('Authentication configuration or request warning');
      },
    },
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    trustedOrigins: config.BETTER_AUTH_TRUSTED_ORIGINS,
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
        roles: { admin: adminAc, user: userAc, superAdmin: adminAc },
      }),
      organization(),
      twoFactor(),
      jwt(),
      openAPI(),
    ],
  });
}
