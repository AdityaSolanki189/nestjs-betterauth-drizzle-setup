import { Module } from '@nestjs/common';
import { db } from '../lib/auth';

export const DRIZZLE = Symbol('DRIZZLE');

@Module({
  providers: [
    {
      provide: DRIZZLE,
      useValue: db,
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
