import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EscalationService } from './escalation.service';

@Injectable()
export class EscalationScheduler {
  private readonly logger = new Logger(EscalationScheduler.name);

  constructor(
    private prisma: PrismaService,
    private escalation: EscalationService,
  ) {}

  @Interval(60000) // Every 60 seconds
  async checkEscalations() {
    const sites = await this.prisma.site.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const site of sites) {
      try {
        await this.escalation.checkBreakdowns(site.id);
        await this.escalation.checkSafetyIncidents(site.id);
        await this.escalation.checkOverdueActions(site.id);
      } catch (e) {
        this.logger.error(`Escalation check failed for site ${site.id}`, e instanceof Error ? e.stack : e);
      }
    }
  }
}
