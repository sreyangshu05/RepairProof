import { Module } from '@nestjs/common';
import { DiagnosticConsistencyController } from './diagnostic-consistency.controller';
import { DiagnosticConsistencyService } from './diagnostic-consistency.service';
import { DiagnosticRuleCatalog } from './diagnostic-rules';
import { LocalExplanationService } from './local-explanation.service';

@Module({
  controllers: [DiagnosticConsistencyController],
  providers: [DiagnosticConsistencyService, DiagnosticRuleCatalog, LocalExplanationService],
  exports: [DiagnosticConsistencyService],
})
export class DiagnosticConsistencyModule {}
