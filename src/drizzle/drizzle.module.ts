import { Injectable, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Environment } from '../config/env.js';
import * as schema from '../database/schema/index.js';

export const DRIZZLE = Symbol('DRIZZLE');

function createDatabase(client: postgres.Sql) {
  return drizzle(client, { schema });
}
export type Database = ReturnType<typeof createDatabase>;

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  readonly client: postgres.Sql;
  readonly db: Database;

  constructor(config: ConfigService<Environment, true>) {
    this.client = postgres(config.get('DATABASE_URL', { infer: true }), {
      max: 10,
      connect_timeout: 5,
      idle_timeout: 20,
    });
    this.db = createDatabase(this.client);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client`select 1`;
    } catch {
      await this.client.end({ timeout: 5 });
      throw new Error('Database connection failed');
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}

@Module({
  providers: [
    DatabaseService,
    {
      provide: DRIZZLE,
      useFactory: (database: DatabaseService) => database.db,
      inject: [DatabaseService],
    },
  ],
  exports: [DRIZZLE, DatabaseService],
})
export class DrizzleModule {}
