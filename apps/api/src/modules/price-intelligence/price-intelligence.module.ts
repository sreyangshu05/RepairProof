import { Module } from '@nestjs/common';
import { PriceIntelligenceController } from './price-intelligence.controller';
import { PriceIntelligenceService } from './price-intelligence.service';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [EvidenceModule],
  controllers: [PriceIntelligenceController],
  providers: [PriceIntelligenceService],
  exports: [PriceIntelligenceService],
})
export class PriceIntelligenceModule {}
