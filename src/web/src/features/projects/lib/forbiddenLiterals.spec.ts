import * as fs from 'fs';
import * as path from 'path';
import { FORBIDDEN_LITERALS } from '@/features/projects/lib/forbiddenLiterals';

/**
 * F001/F002/F003 — source-scan: không literal giả nào của mẫu được xuất hiện
 * trong source (ngoài *.spec.* / *.test.* — chính các file audit này chứa
 * chúng như oracle). Bổ sung cho render-assertion trong
 * ProjectsWorkspace.noFabrication.spec.tsx.
 */
function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      collectSourceFiles(full, out);
    } else if (/\.(tsx?|css)$/.test(entry.name)) {
      if (/\.spec\.[^.]+$/.test(entry.name) || /\.test\.[^.]+$/.test(entry.name)) continue;
      // Chính oracle canonical list chứa các literal theo thiết kế.
      if (entry.name === 'forbiddenLiterals.ts') continue;
      out.push(full);
    }
  }
  return out;
}

describe('anti-fabrication source scan (F001/F002/F003)', () => {
  it('không chứa FORBIDDEN literal trong source ngoài spec', () => {
    const root = path.join(process.cwd(), 'src');
    const files = collectSourceFiles(root);
    expect(files.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      for (const lit of FORBIDDEN_LITERALS) {
        if (content.includes(lit)) hits.push(`${path.relative(root, f)} :: ${lit}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
