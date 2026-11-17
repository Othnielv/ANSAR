import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierAccountEntryDto } from './create-supplier-account-entry.dto';

export class UpdateSupplierAccountEntryDto extends PartialType(CreateSupplierAccountEntryDto) {}
