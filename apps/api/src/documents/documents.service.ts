import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VALID_CATEGORIES = ['policy', 'procedure', 'form', 'specification'];
const VALID_STATUSES = ['draft', 'review', 'approved', 'obsolete'];

// Status state machine: draft → review → approved → obsolete
// Approved can go back to review for re-approval
const NEXT_STATUS: Record<string, string[]> = {
  draft: ['review'],
  review: ['approved', 'draft'],
  approved: ['review', 'obsolete'],
  obsolete: [],
};

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(siteId: string, filters?: { category?: string; status?: string; search?: string }) {
    const where: any = { siteId };
    if (filters?.category && VALID_CATEGORIES.includes(filters.category)) {
      where.category = filters.category;
    }
    if (filters?.status && VALID_STATUSES.includes(filters.status)) {
      where.status = filters.status;
    }
    if (filters?.search) {
      // SQLite: contains is case-sensitive, so search both cases
      const s = filters.search;
      where.OR = [
        { title: { contains: s } },
        { title: { contains: s.toLowerCase() } },
        { title: { contains: s.toUpperCase() } },
        { description: { contains: s } },
        { description: { contains: s.toLowerCase() } },
      ];
    }

    return this.prisma.document.findMany({
      where,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        _count: { select: { revisions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(id: string, siteId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, siteId },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        revisions: {
          include: { uploadedBy: { select: { firstName: true, lastName: true } } },
          orderBy: { version: 'desc' },
        },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async create(siteId: string, createdById: string, data: {
    title: string;
    description?: string;
    category: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
  }) {
    if (!VALID_CATEGORIES.includes(data.category)) {
      throw new BadRequestException(`Invalid category. Must be: ${VALID_CATEGORIES.join(', ')}`);
    }

    const doc = await this.prisma.document.create({
      data: {
        siteId,
        createdById,
        title: data.title,
        description: data.description,
        category: data.category,
        // If file provided, create initial revision
        ...(data.fileUrl ? {
          revisions: {
            create: {
              version: 1,
              fileUrl: data.fileUrl,
              fileName: data.fileName || 'document',
              fileSize: data.fileSize || 0,
              uploadedById: createdById,
              changeNotes: 'Initial version',
            },
          },
        } : {}),
      },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        revisions: { include: { uploadedBy: { select: { firstName: true, lastName: true } } } },
        _count: { select: { revisions: true } },
      },
    });

    return doc;
  }

  async update(id: string, siteId: string, data: {
    title?: string;
    description?: string;
    category?: string;
  }) {
    const doc = await this.prisma.document.findFirst({ where: { id, siteId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.status === 'approved') {
      throw new BadRequestException('Cannot edit an approved document. Create a new revision or set to review first.');
    }

    if (data.category && !VALID_CATEGORIES.includes(data.category)) {
      throw new BadRequestException(`Invalid category. Must be: ${VALID_CATEGORIES.join(', ')}`);
    }

    return this.prisma.document.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        _count: { select: { revisions: true } },
      },
    });
  }

  async addRevision(id: string, siteId: string, uploadedById: string, data: {
    fileUrl: string;
    fileName: string;
    fileSize: number;
    changeNotes?: string;
  }) {
    const doc = await this.prisma.document.findFirst({ where: { id, siteId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.status === 'obsolete') throw new BadRequestException('Cannot add revisions to an obsolete document');

    const newVersion = doc.currentVersion + 1;

    await this.prisma.$transaction([
      this.prisma.documentRevision.create({
        data: {
          documentId: id,
          version: newVersion,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileSize: data.fileSize,
          changeNotes: data.changeNotes,
          uploadedById,
        },
      }),
      this.prisma.document.update({
        where: { id },
        data: {
          currentVersion: newVersion,
          // New revision resets status to draft for re-approval
          status: doc.status === 'approved' ? 'review' : doc.status,
        },
      }),
    ]);

    return this.findById(id, siteId);
  }

  async changeStatus(id: string, siteId: string, newStatus: string, userId: string) {
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new BadRequestException(`Invalid status. Must be: ${VALID_STATUSES.join(', ')}`);
    }

    const doc = await this.prisma.document.findFirst({ where: { id, siteId } });
    if (!doc) throw new NotFoundException('Document not found');

    const allowed = NEXT_STATUS[doc.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Cannot transition from "${doc.status}" to "${newStatus}". Allowed: ${allowed.join(', ') || 'none'}`);
    }

    const updateData: any = { status: newStatus };
    if (newStatus === 'approved') {
      updateData.approvedById = userId;
      updateData.approvedAt = new Date();
    }

    return this.prisma.document.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        _count: { select: { revisions: true } },
      },
    });
  }
}
