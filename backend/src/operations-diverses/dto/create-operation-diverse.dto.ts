import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

const PARTIES = [
  'Yassa', 'Afb', 'CCA', 'SGC', 'Top Mobile',
  'Crédit du Sahel', 'Shop', 'Account',
] as const;

export class CreateOperationDiverseDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsIn(PARTIES)
  partie: string;

  @IsString()
  @IsIn(['entree', 'sortie'])
  type: 'entree' | 'sortie';

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
  @IsString()
  utilisateur?: string;
}
