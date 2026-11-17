import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplierAccountEntry } from '../entities/supplier-account-entry.entity';
import { SupplierAccountsService } from './supplier-accounts.service';
import { SupplierAccountsController } from './supplier-accounts.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([SupplierAccountEntry]), AuditLogsModule],
  controllers: [SupplierAccountsController],
  providers: [SupplierAccountsService],
  exports: [SupplierAccountsService],
})
export class SupplierAccountsModule {}
