import { Controller, Get } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AllowAnonymous, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { AppService } from './app.service';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @AllowAnonymous()
  @ApiOperation({ summary: 'Health / hello' })
  @ApiOkResponse({
    description: 'Plain text greeting',
    schema: { type: 'string', example: 'Hello World!' },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('me')
  @ApiOperation({ summary: 'Current user from session' })
  @ApiCookieAuth('better-auth.session_token')
  @ApiOkResponse({
    description: 'Greeting with the signed-in user name',
    schema: { type: 'string', example: 'Hello Ada' },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session' })
  getMe(@Session() session: UserSession): string {
    return `Hello ${session.user.name}`;
  }
}
