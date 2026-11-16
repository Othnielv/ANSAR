import { Entity, PrimaryColumn, Column } from 'typeorm';

export type OdTxType = 'entree' | 'sortie';

@Entity('operations_diverses')
export class OperationDiverseEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id: string;

  @Column({ type: 'varchar', length: 60 })
  partie: string;

  @Column({ type: 'varchar', length: 20 })
  type: OdTxType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  montant: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utilisateur?: string;

  @Column({ name: 'createdAt', type: 'timestamp', nullable: true })
  createdAt?: Date;
}
