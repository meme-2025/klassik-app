import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KaspaPaymentService } from './kaspa-payment.service';
import { KaspaTransaction } from './entities/kaspa-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KaspaTransaction])],
  providers: [KaspaPaymentService],
  exports: [KaspaPaymentService],
})
export class KaspaModule {}
