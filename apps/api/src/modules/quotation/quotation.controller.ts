import { Controller, Get, Post, Body, Param, Headers } from '@nestjs/common';
import { QuotationService } from './quotation.service';
import { CreateQuotationDto } from './quotation.dto';
import {
  CurrentUser,
  AuthenticatedUser,
  requireProfileId,
  requireShopId,
} from '../../common/decorators/current-user.decorator';

@Controller('cases/:caseId/quotations')
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Post()
  async create(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string,
    @Body() dto: CreateQuotationDto,
  ) {
    return this.quotationService.create(
      caseId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
      key,
      dto,
    );
  }

  @Get()
  async findByCase(@Param('caseId') caseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quotationService.findByCase(
      caseId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
    );
  }

  @Post(':quoteId/send')
  async sendToCustomer(
    @Param('caseId') caseId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string,
  ) {
    return this.quotationService.sendToCustomer(
      caseId,
      requireShopId(user),
      requireProfileId(user),
      user.role,
      quoteId,
      key,
    );
  }
}
