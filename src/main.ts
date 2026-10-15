import { Logger } from '@nestjs/common';
import { bootstrap } from './bootstrap.js';

bootstrap().catch(() => {
  Logger.error(
    'Application startup failed. Check configuration, database availability, and port binding.',
    'Bootstrap',
  );
  process.exitCode = 1;
});
