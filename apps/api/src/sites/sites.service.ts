import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(private prisma: PrismaService) {}

  async findAllByCorporate(corporateId: string) {
    return this.prisma.site.findMany({
      where: { corporateId },
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, fiveSAudits: true, kaizenItems: true } },
        corporate: { select: { name: true } },
      },
    });
    if (!site) throw new NotFoundException('Site not found');
    return site;
  }

  async create(dto: CreateSiteDto, corporateId: string) {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return this.prisma.site.create({
      data: {
        name: dto.name,
        slug,
        location: dto.location,
        timezone: dto.timezone || 'Europe/Rome',
        corporateId,
      },
    });
  }

  async update(id: string, dto: UpdateSiteDto) {
    return this.prisma.site.update({
      where: { id },
      data: dto,
    });
  }
}
