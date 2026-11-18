import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { QuotationService } from './quotation.service';
import { CreateQuotationDto } from './quotation.dto';

@Controller('cases/:caseId/quotations')
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Post()
  async create(@Param('caseId') caseId: string, @Body() dto: CreateQuotationDto) {
    return this.quotationService.create(caseId, dto);
  }

  @Get()
  async findByCase(@Param('caseId') caseId: string) {
    return this.quotationService.findByCase(caseId);
  }

  @Post(':quoteId/send')
  async sendToCustomer(
    @Param('caseId') caseId: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.quotationService.sendToCustomer(caseId, quoteId);
  }
}
