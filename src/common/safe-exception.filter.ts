import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';

@Catch()
export class SafeExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException) {
      super.catch(exception, host);
      return;
    }
    this.logger.error('Unhandled request failure');
    const { httpAdapter } = this.adapterHost;
    const response: unknown = host.switchToHttp().getResponse();
    if (!httpAdapter.isHeadersSent(response)) {
      httpAdapter.reply(response, { statusCode: 500, message: 'Internal server error' }, 500);
    } else {
      httpAdapter.end(response);
    }
  }
}
