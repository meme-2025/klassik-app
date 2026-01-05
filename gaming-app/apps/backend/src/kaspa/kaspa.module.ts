import { Module } from '@nestjs/common';
import { KaspaService } from './kaspa.service';

@Module({
  providers: [KaspaService],
  exports: [KaspaService],
})
export class KaspaModule {}
