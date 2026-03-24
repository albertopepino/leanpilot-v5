import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import * as FileType from 'file-type';

const MAX_STORAGE_BYTES = 1024 * 1024 * 1024; // 1 GB per site
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.gif'];
const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
];

@Injectable()
export class UploadsService {
  private s3: S3Client;
  private bucket: string;
  private endpoint: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.endpoint = this.config.get<string>('S3_ENDPOINT', 'https://nbg1.your-objectstorage.com');
    this.bucket = this.config.get<string>('S3_BUCKET', 'leanos');

    this.s3 = new S3Client({
      endpoint: this.endpoint,
      region: this.config.get<string>('S3_REGION', 'nbg1'),
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY', ''),
        secretAccessKey: this.config.get<string>('S3_SECRET_KEY', ''),
      },
      forcePathStyle: true,
    });
  }

  async validateFile(file: Express.Multer.File): Promise<void> {
    if (!file) throw new BadRequestException('No file provided');

    // Validate extension
    const rawExt = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(rawExt)) {
      throw new BadRequestException(`File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }

    // Validate MIME type from header
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(`MIME type not allowed: ${file.mimetype}`);
    }

    // Validate actual file content via magic bytes (don't trust client headers)
    const detected = await FileType.fromBuffer(file.buffer);
    if (detected && !ALLOWED_MIMES.includes(detected.mime)) {
      throw new BadRequestException(`File content does not match an allowed type. Detected: ${detected.mime}`);
    }
    // PDFs may not always be detected by file-type; allow if extension is .pdf and no conflicting detection
    if (!detected && rawExt !== '.pdf') {
      throw new BadRequestException('Could not verify file type from content');
    }
  }

  async upload(
    file: Express.Multer.File,
    siteId: string,
    func: string,
  ): Promise<{ url: string; key: string }> {
    await this.validateFile(file);

    // Safe extension from whitelist
    const rawExt = extname(file.originalname).toLowerCase();
    const ext = ALLOWED_EXTENSIONS.includes(rawExt) ? rawExt : '.bin';

    // 1. Check quota (read-only, no increment yet)
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: { corporate: true },
    });
    if (!site) throw new BadRequestException('Site not found');

    const used = Number(site.storageUsedBytes);
    if (used + file.size > MAX_STORAGE_BYTES) {
      throw new BadRequestException(
        `Storage quota exceeded. Used: ${(used / 1024 / 1024).toFixed(1)}MB / ${(MAX_STORAGE_BYTES / 1024 / 1024).toFixed(0)}MB`,
      );
    }

    // 2. Build key and upload to S3 FIRST (before committing quota)
    const uuid = randomUUID();
    const key = `${site.corporate.slug}/${site.slug}/${func}/${uuid}${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    ).catch(() => {
      throw new BadRequestException('Failed to upload file to storage');
    });

    // 3. S3 succeeded — now atomically increment quota
    await this.prisma.site.update({
      where: { id: siteId },
      data: { storageUsedBytes: { increment: BigInt(file.size) } },
    });

    const url = `${this.endpoint}/${this.bucket}/${key}`;
    return { url, key };
  }

  async delete(key: string, siteId: string, fileSize: number): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    await this.prisma.site.update({
      where: { id: siteId },
      data: { storageUsedBytes: { decrement: BigInt(Math.max(0, fileSize)) } },
    });
  }

  async getQuota(siteId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    const used = Number(site?.storageUsedBytes || 0);
    return {
      usedBytes: used,
      limitBytes: MAX_STORAGE_BYTES,
      usedMB: Math.round((used / 1024 / 1024) * 10) / 10,
      limitMB: Math.round(MAX_STORAGE_BYTES / 1024 / 1024),
      percentUsed: Math.round((used / MAX_STORAGE_BYTES) * 1000) / 10,
    };
  }
}
