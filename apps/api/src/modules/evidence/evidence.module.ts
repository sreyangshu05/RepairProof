import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EvidenceService } from './evidence.service';
import { EvidenceController } from './evidence.controller';
import { ObjectStorageService, SupabaseObjectStorageAdapter } from './object-storage.service';
import { ClamAvMalwareScanner } from './clamav-malware-scanner.service';
import { EvidenceRetentionWorker } from './evidence-retention.worker';
import { EvidenceDeletionController } from './evidence-deletion.controller';

@Module({
  controllers: [EvidenceController, EvidenceDeletionController],
  imports: [ConfigModule],
  providers: [
    EvidenceService,
    SupabaseObjectStorageAdapter,
    { provide: ObjectStorageService, useExisting: SupabaseObjectStorageAdapter },
    ClamAvMalwareScanner,
    EvidenceRetentionWorker,
  ],
  exports: [EvidenceService, ObjectStorageService, ClamAvMalwareScanner],
})
export class EvidenceModule {}
