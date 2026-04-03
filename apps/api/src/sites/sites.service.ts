import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(private prisma: PrismaService) {}

  async findAllByCorporate(corporateId: string, limit = 50, offset = 0) {
    const take = Math.min(Math.max(1, limit), 200);
    const skip = Math.max(0, offset);
    const where = { corporateId };

    const [data, total] = await Promise.all([
      this.prisma.site.findMany({
        where,
        include: {
          _count: { select: { users: true, workstations: true } },
        },
        orderBy: { name: 'asc' },
        take,
        skip,
      }),
      this.prisma.site.count({ where }),
    ]);

    return { data, total, limit: take, offset: skip };
  }

  async findById(id: string, corporateId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id, corporateId },
      include: {
        _count: { select: { users: true, workstations: true, orders: true } },
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

  async update(id: string, corporateId: string, dto: UpdateSiteDto) {
    const site = await this.prisma.site.findFirst({ where: { id, corporateId } });
    if (!site) throw new NotFoundException('Site not found');
    return this.prisma.site.update({ where: { id }, data: dto });
  }
}
