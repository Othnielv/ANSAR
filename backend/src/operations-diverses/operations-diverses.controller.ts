import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { OperationsDiversesService } from './operations-diverses.service';
import { CreateOperationDiverseDto } from './dto/create-operation-diverse.dto';
import { UpdateOperationDiverseDto } from './dto/update-operation-diverse.dto';

@Controller('operations-diverses')
export class OperationsDiversesController {
  constructor(private readonly service: OperationsDiversesService) {}

  private getActor(req: Request): { login?: string; role?: string } {
    const login = req.headers['x-actor-login'];
    const role = req.headers['x-actor-role'];
    return {
      login: typeof login === 'string' ? login : undefined,
      role: typeof role === 'string' ? role : undefined,
    };
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateOperationDiverseDto, @Req() req: Request) {
    return this.service.create(dto, this.getActor(req));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOperationDiverseDto,
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
