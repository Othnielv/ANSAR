import { PartialType } from '@nestjs/mapped-types';
import { CreateOperationDiverseDto } from './create-operation-diverse.dto';

export class UpdateOperationDiverseDto extends PartialType(CreateOperationDiverseDto) {}
