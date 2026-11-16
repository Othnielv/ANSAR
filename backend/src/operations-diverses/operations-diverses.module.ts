import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationDiverseEntity } from '../entities/operation-diverse.entity';
import { OperationsDiversesController } from './operations-diverses.controller';
import { OperationsDiversesService } from './operations-diverses.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([OperationDiverseEntity]), AuditLogsModule],
  controllers: [OperationsDiversesController],
  providers: [OperationsDiversesService],
  exports: [OperationsDiversesService],
})
export class OperationsDiversesModule {}
