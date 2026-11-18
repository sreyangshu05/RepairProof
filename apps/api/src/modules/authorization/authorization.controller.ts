import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { CustomerAuthorizationResponseDto } from './authorization.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('authorize')
export class AuthorizationController {
  constructor(private readonly authService: AuthorizationService) {}

  @Public()
  @Get(':token')
  async getCase(@Param('token') token: string) {
    return this.authService.getCaseByToken(token);
  }

  @Public()
  @Post(':token/respond')
  async respond(
    @Param('token') token: string,
    @Body() dto: CustomerAuthorizationResponseDto,
  ) {
    return this.authService.respondToQuotation(token, dto);
  }
}
