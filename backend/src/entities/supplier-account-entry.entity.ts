import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ThirdParty } from './third-party.entity';

export type SupplierAccountEntryType =
  | 'depot'
  | 'retrait'
  | 'emprunt'
  | 'remboursement';

@Entity('supplier_account_entries')
export class SupplierAccountEntry {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  fournisseurId: string;

  @Column({ type: 'varchar', length: 30 })
  type: SupplierAccountEntryType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montant: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference?: string;

  @Column({ type: 'uuid', nullable: true })
  supplierLoadingId?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utilisateur?: string;

  @Column({ name: 'createdAt', type: 'timestamp', nullable: true })
  createdAt?: Date;

  @ManyToOne(() => ThirdParty)
  @JoinColumn({ name: 'fournisseurId' })
  fournisseur?: ThirdParty;
}
