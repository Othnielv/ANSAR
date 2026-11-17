import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SupplierAccountEntry } from '../entities/supplier-account-entry.entity';
import { CreateSupplierAccountEntryDto } from './dto/create-supplier-account-entry.dto';
import { UpdateSupplierAccountEntryDto } from './dto/update-supplier-account-entry.dto';
import { AuditActor, AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class SupplierAccountsService {
  constructor(
    @InjectRepository(SupplierAccountEntry)
    private readonly repo: Repository<SupplierAccountEntry>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAll(): Promise<SupplierAccountEntry[]> {
    return this.repo.find({ order: { date: 'DESC', createdAt: 'DESC' } });
  }

  async findByFournisseur(fournisseurId: string): Promise<SupplierAccountEntry[]> {
    return this.repo.find({
      where: { fournisseurId },
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<SupplierAccountEntry> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Mouvement compte fournisseur ${id} introuvable`);
    return row;
  }

  async create(dto: CreateSupplierAccountEntryDto, actor?: AuditActor): Promise<SupplierAccountEntry> {
    const id = dto.id?.trim() || uuidv4();
    const utilisateur = dto.utilisateur?.trim() || actor?.login || 'Système';
    const row = this.repo.create({
      id,
      fournisseurId: dto.fournisseurId,
      type: dto.type,
      montant: String(dto.montant),
      date: dto.date,
      description: dto.description.trim(),
      reference: dto.reference?.trim() || undefined,
      supplierLoadingId: dto.supplierLoadingId || undefined,
      utilisateur,
      createdAt: new Date(),
    });
    const saved = await this.repo.save(row);
    await this.auditLogsService.log({
      module: 'supplier_accounts',
      action: 'create',
      entityId: saved.id,
      summary: `${dto.type} ${dto.montant} FCFA – fournisseur ${dto.fournisseurId}`,
      afterData: { ...saved },
      actor,
    });
    return saved;
  }

  async update(id: string, dto: UpdateSupplierAccountEntryDto, actor?: AuditActor): Promise<SupplierAccountEntry> {
    const existing = await this.findOne(id);
    const before = { ...existing };
    if (dto.fournisseurId !== undefined) existing.fournisseurId = dto.fournisseurId;
    if (dto.type !== undefined) existing.type = dto.type;
    if (dto.montant !== undefined) existing.montant = String(dto.montant);
    if (dto.date !== undefined) existing.date = dto.date;
    if (dto.description !== undefined) existing.description = dto.description.trim();
    if (dto.reference !== undefined) existing.reference = dto.reference?.trim() || undefined;
    if (dto.supplierLoadingId !== undefined) existing.supplierLoadingId = dto.supplierLoadingId || undefined;
    if (dto.utilisateur !== undefined) existing.utilisateur = dto.utilisateur?.trim() || undefined;
    const saved = await this.repo.save(existing);
    await this.auditLogsService.log({
      module: 'supplier_accounts',
      action: 'update',
      entityId: id,
      summary: `Modification mouvement ${id}`,
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
      module: 'supplier_accounts',
      action: 'delete',
      entityId: id,
      summary: `Suppression mouvement ${id} – ${existing.type} ${existing.montant} FCFA`,
      beforeData: { ...existing, id },
      actor,
    });
  }
}
