import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { OperationDiverseEntity } from '../entities/operation-diverse.entity';
import { CreateOperationDiverseDto } from './dto/create-operation-diverse.dto';
import { UpdateOperationDiverseDto } from './dto/update-operation-diverse.dto';
import { AuditActor, AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class OperationsDiversesService {
  constructor(
    @InjectRepository(OperationDiverseEntity)
    private readonly repo: Repository<OperationDiverseEntity>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAll(): Promise<OperationDiverseEntity[]> {
    return this.repo.find({ order: { date: 'DESC', createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<OperationDiverseEntity> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Opération diverse ${id} introuvable`);
    return row;
  }

  async create(dto: CreateOperationDiverseDto, actor?: AuditActor): Promise<OperationDiverseEntity> {
    const id = dto.id?.trim() || uuidv4();
    const utilisateur = dto.utilisateur?.trim() || actor?.login || 'Système';
    const row = this.repo.create({
      id,
      partie: dto.partie,
      type: dto.type,
      montant: String(dto.montant),
      date: dto.date,
      description: dto.description.trim(),
      reference: dto.reference?.trim() || undefined,
      utilisateur,
      createdAt: new Date(),
    });
    const saved = await this.repo.save(row);
    await this.auditLogsService.log({
      module: 'operations_diverses',
      action: 'create',
      entityId: saved.id,
      summary: `${dto.type} ${dto.montant} FCFA – ${dto.partie} – ${dto.description}`,
      afterData: { ...saved },
      actor,
    });
    return saved;
  }

  async update(id: string, dto: UpdateOperationDiverseDto, actor?: AuditActor): Promise<OperationDiverseEntity> {
    const existing = await this.findOne(id);
    const before = { ...existing };
    if (dto.partie !== undefined) existing.partie = dto.partie;
    if (dto.type !== undefined) existing.type = dto.type;
    if (dto.montant !== undefined) existing.montant = String(dto.montant);
    if (dto.date !== undefined) existing.date = dto.date;
    if (dto.description !== undefined) existing.description = dto.description.trim();
    if (dto.reference !== undefined) existing.reference = dto.reference?.trim() || undefined;
    if (dto.utilisateur !== undefined) existing.utilisateur = dto.utilisateur?.trim() || undefined;
    const saved = await this.repo.save(existing);
    await this.auditLogsService.log({
      module: 'operations_diverses',
      action: 'update',
      entityId: id,
      summary: `Modification OD ${id}`,
      beforeData: before,
      afterData: { ...saved },
      actor,
    });
    return saved;
  }

  async remove(id: string, actor?: AuditActor): Promise<void> {
    const existing = await this.findOne(id);
    await this.repo.remove(existing);
    await this.auditLogsService.log({
      module: 'operations_diverses',
      action: 'delete',
      entityId: id,
      summary: `Suppression OD ${id} – ${existing.partie} – ${existing.description}`,
      beforeData: { ...existing, id },
      actor,
    });
  }
}
