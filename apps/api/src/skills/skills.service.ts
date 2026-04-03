import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_CATEGORIES = ['technical', 'safety', 'quality', 'leadership', 'process'];

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

  async findAll(siteId: string, limit = 50, offset = 0) {
    const take = Math.min(Math.max(1, limit), 200);
    const skip = Math.max(0, offset);
    const where = { siteId };

    const [data, total] = await Promise.all([
      this.prisma.skill.findMany({
        where,
        orderBy: { name: 'asc' },
        take,
        skip,
      }),
      this.prisma.skill.count({ where }),
    ]);

    return { data, total, limit: take, offset: skip };
  }

  async create(siteId: string, data: {
    name: string;
    category?: string;
    description?: string;
  }) {
    if (data.category && !VALID_CATEGORIES.includes(data.category)) {
      throw new BadRequestException(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    return this.prisma.skill.create({
      data: {
        siteId,
        name: data.name,
        category: data.category || 'technical',
        description: data.description,
      },
    });
  }

  async update(id: string, siteId: string, data: {
    name?: string;
    category?: string;
    description?: string;
    isActive?: boolean;
  }) {
    const skill = await this.prisma.skill.findFirst({ where: { id, siteId } });
    if (!skill) throw new NotFoundException('Skill not found');

    if (data.category && !VALID_CATEGORIES.includes(data.category)) {
      throw new BadRequestException(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    return this.prisma.skill.update({
      where: { id },
      data,
    });
  }

  async getMatrix(siteId: string) {
    const [skills, users] = await Promise.all([
      this.prisma.skill.findMany({
        where: { siteId, isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { siteId, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          userSkills: {
            include: {
              skill: { select: { id: true, name: true } },
              assessedBy: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { lastName: 'asc' },
      }),
    ]);

    return { skills, users };
  }

  async setUserSkillLevel(siteId: string, userId: string, skillId: string, assessedById: string, data: {
    level: number;
    certifiedDate?: string;
    expiryDate?: string;
    notes?: string;
  }) {
    if (data.level < 0 || data.level > 4) {
      throw new BadRequestException('Level must be 0-4 (0=none, 1=learning, 2=competent, 3=proficient, 4=trainer)');
    }

    // Validate user and skill belong to site
    const [user, skill] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, siteId } }),
      this.prisma.skill.findFirst({ where: { id: skillId, siteId } }),
    ]);
    if (!user) throw new BadRequestException('User not found or does not belong to this site');
    if (!skill) throw new BadRequestException('Skill not found or does not belong to this site');

    return this.prisma.userSkill.upsert({
      where: { userId_skillId: { userId, skillId } },
      create: {
        userId,
        skillId,
        level: data.level,
        assessedById,
        certifiedDate: data.certifiedDate ? new Date(data.certifiedDate) : undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        notes: data.notes,
      },
      update: {
        level: data.level,
        assessedById,
        certifiedDate: data.certifiedDate ? new Date(data.certifiedDate) : undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        notes: data.notes,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        skill: { select: { id: true, name: true } },
        assessedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getUserSkills(siteId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, siteId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.userSkill.findMany({
      where: { userId },
      include: {
        skill: true,
        assessedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { skill: { name: 'asc' } },
    });
  }

  async getGaps(siteId: string) {
    // Skills where no user has level 3+ (proficient/trainer)
    const skills = await this.prisma.skill.findMany({
      where: { siteId, isActive: true },
      include: {
        userSkills: {
          where: { level: { gte: 3 } },
          select: { id: true },
        },
      },
    });

    return skills
      .filter((s) => s.userSkills.length === 0)
      .map(({ userSkills, ...skill }) => skill);
  }
}
