import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { SupplierAccountsService } from './supplier-accounts.service';
import { CreateSupplierAccountEntryDto } from './dto/create-supplier-account-entry.dto';
import { UpdateSupplierAccountEntryDto } from './dto/update-supplier-account-entry.dto';

@Controller('supplier-accounts')
export class SupplierAccountsController {
  constructor(private readonly service: SupplierAccountsService) {}

  private getActor(req: Request): { login?: string; role?: string } {
    const login = req.headers['x-actor-login'];
    const role = req.headers['x-actor-role'];
    return {
      login: typeof login === 'string' ? login : undefined,
      role: typeof role === 'string' ? role : undefined,
    };
  }

  @Get()
  findAll(@Query('fournisseurId') fournisseurId?: string) {
    if (fournisseurId) return this.service.findByFournisseur(fournisseurId);
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateSupplierAccountEntryDto, @Req() req: Request) {
    return this.service.create(dto, this.getActor(req));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierAccountEntryDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, this.getActor(req));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: Request): Promise<void> {
    await this.service.remove(id, this.getActor(req));
  }
}
