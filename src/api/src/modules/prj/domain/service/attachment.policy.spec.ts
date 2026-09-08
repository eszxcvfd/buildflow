import {
  ATTACHMENT_MAX_SIZE_BYTES,
  assertUploadableFile,
  normalizeAttachmentCaption,
  normalizeAttachmentRequestKey,
  normalizeRetireReason,
  sanitizeFileName,
  sniffAttachmentMime,
} from './attachment.policy';

// PRJ-SRS-009 (issue #40) — policy unit: mime/size/magic/path-traversal.

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

describe('attachment.policy (PRJ-SRS-009)', () => {
  it('sniff nhận diện JPEG/PNG/WebP/PDF, từ chối EXE', () => {
    expect(sniffAttachmentMime(JPEG)).toBe('image/jpeg');
    expect(sniffAttachmentMime(PNG)).toBe('image/png');
    expect(sniffAttachmentMime(WEBP)).toBe('image/webp');
    expect(sniffAttachmentMime(PDF)).toBe('application/pdf');
    expect(sniffAttachmentMime(EXE)).toBeNull();
    expect(sniffAttachmentMime(Buffer.alloc(0))).toBeNull();
  });

  it('accept đúng cặp mime+magic', () => {
    expect(assertUploadableFile(JPEG, 'image/jpeg')).toBe('image/jpeg');
    expect(assertUploadableFile(PNG, 'image/png')).toBe('image/png');
    expect(assertUploadableFile(WEBP, 'image/webp')).toBe('image/webp');
    expect(assertUploadableFile(PDF, 'application/pdf')).toBe('application/pdf');
  });

  it('reject header không trong allowlist (exe, svg, zip)', () => {
    expect(() => assertUploadableFile(EXE, 'application/x-msdownload')).toThrow(
      'loại được phê duyệt',
    );
    expect(() => assertUploadableFile(PDF, 'image/svg+xml')).toThrow('loại được phê duyệt');
  });

  it('reject fake: EXE đổi tên .pdf/.jpg (không tin header)', () => {
    expect(() => assertUploadableFile(EXE, 'application/pdf')).toThrow();
    expect(() => assertUploadableFile(EXE, 'image/jpeg')).toThrow();
  });

  it('reject mismatch magic vs khai báo (PDF ruột PNG)', () => {
    expect(() => assertUploadableFile(PNG, 'application/pdf')).toThrow('không khớp');
  });

  it('reject rỗng và quá 10MB', () => {
    expect(() => assertUploadableFile(Buffer.alloc(0), 'image/png')).toThrow();
    const big = Buffer.alloc(ATTACHMENT_MAX_SIZE_BYTES + 1);
    big[0] = 0x89;
    big[1] = 0x50;
    big[2] = 0x4e;
    big[3] = 0x47;
    expect(() => assertUploadableFile(big, 'image/png')).toThrow('10MB');
  });

  it('sanitize chặn path traversal, giữ tên hợp lệ', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('..\\..\\win\\evil.exe')).toBe('evil.exe');
    expect(sanitizeFileName('/abs/path/a.png')).toBe('a.png');
    expect(sanitizeFileName('ảnh hiện trường 01.jpg')).toBe('ảnh hiện trường 01.jpg');
    expect(sanitizeFileName('')).toBe('file');
    expect(sanitizeFileName('...')).toBe('file');
    expect(sanitizeFileName('a\u0000b.png')).toBe('ab.png');
    expect(sanitizeFileName('x'.repeat(300)).length).toBeLessThanOrEqual(255);
  });

  it('caption/reason: null khi thiếu/rỗng, 400 khi quá dài', () => {
    expect(normalizeAttachmentCaption(undefined)).toBeNull();
    expect(normalizeAttachmentCaption('  ')).toBeNull();
    expect(normalizeAttachmentCaption('ok')).toBe('ok');
    expect(() => normalizeAttachmentCaption('x'.repeat(501))).toThrow('500');
    expect(normalizeRetireReason(undefined)).toBeNull();
    expect(() => normalizeRetireReason('x'.repeat(501))).toThrow('500');
  });

  it('requestKey: null khi thiếu, lowercase uuid, reject sai format', () => {
    expect(normalizeAttachmentRequestKey(undefined)).toBeNull();
    expect(normalizeAttachmentRequestKey('  ')).toBeNull();
    expect(normalizeAttachmentRequestKey('AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE')).toBe(
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    );
    expect(() => normalizeAttachmentRequestKey('not-a-uuid')).toThrow('UUID');
  });
});
