import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthorizationService } from './authorization.service';
import {
  CreateCustomerDisputeDto,
  CustomerAuthorizationResponseDto,
  UpdateCustomerLocaleDto,
} from './authorization.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('authorize')
export class AuthorizationController {
  constructor(
    private readonly authService: AuthorizationService,
    private readonly config: ConfigService,
  ) {}

  private ensurePublicAuthorizationEnabled() {
    if (this.config.get<string>('CUSTOMER_AUTHORIZATION_ENABLED') !== 'true') {
      throw new ServiceUnavailableException('Customer authorization links are not enabled');
    }
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Get(':token')
  async getCase(@Param('token') token: string) {
    this.ensurePublicAuthorizationEnabled();
    return this.authService.getCaseByToken(token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Post(':token/locale')
  async updateLocale(@Param('token') token: string, @Body() dto: UpdateCustomerLocaleDto) {
    this.ensurePublicAuthorizationEnabled();
    return this.authService.updateCustomerLocale(token, dto.locale);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Get(':token/evidence/:evidenceId')
  async getEvidence(@Param('token') token: string, @Param('evidenceId') evidenceId: string) {
    this.ensurePublicAuthorizationEnabled();
    return this.authService.getEvidenceDownload(token, evidenceId);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Post(':token/respond')
  async respond(
    @Param('token') token: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CustomerAuthorizationResponseDto,
  ) {
    this.ensurePublicAuthorizationEnabled();
    return this.authService.respondToQuotation(token, idempotencyKey, dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Post(':token/disputes')
  async openDispute(
    @Param('token') token: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateCustomerDisputeDto,
  ) {
    this.ensurePublicAuthorizationEnabled();
    return this.authService.openDispute(token, idempotencyKey, dto);
  }
}
