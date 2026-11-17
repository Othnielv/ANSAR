import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

const ENTRY_TYPES = ['depot', 'retrait', 'emprunt', 'remboursement'] as const;

export class CreateSupplierAccountEntryDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsUUID()
  fournisseurId: string;

  @IsString()
  @IsIn(ENTRY_TYPES)
  type: 'depot' | 'retrait' | 'emprunt' | 'remboursement';

  @IsNumber()
  @Min(0.01)
  montant: number;

  @IsString()
  date: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsUUID()
  supplierLoadingId?: string;

  @IsOptional()
  @IsString()
  utilisateur?: string;
}
