import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));
const specsDir = join(repoRoot, 'openspec', 'specs');
const archiveDir = join(repoRoot, 'openspec', 'changes', 'archive');

const legacyArchiveAllowlist = new Set([
  '2026-07-02-r-01-monorepo-scaffold',
  '2026-07-02-r-02-supabase-local-dev',
  '2026-07-02-r-03-cicd-security-gates',
  '2026-07-02-r-04-core-schema-rls',
  '2026-07-02-r-05-supabase-auth',
  '2026-07-02-r-06-api-skeleton',
  '2026-07-02-r-07-profile-management',
  '2026-07-02-r-08-source-management',
  '2026-07-03-r-09-flow-management',
  '2026-07-03-r-10-delivery-channels',
  '2026-07-03-r-11-scheduler-queue',
]);

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function hasVerifierPass(report: string): boolean {
  return /\b(?:Verdict|Attempt \d+|Result)\b[\s\S]{0,80}\bPASS\b/i.test(report);
}

function hasReviewerApprove(report: string): boolean {
  return /\b(?:Verdict|Attempt \d+|Result|Disposition)\b[\s\S]{0,80}\bAPPROVE\b/i.test(report);
}

function hasUnresolvedRequestChanges(report: string): boolean {
  const lowerReport = report.toLowerCase();
  const lastRequestChanges = lowerReport.lastIndexOf('request changes');
  if (lastRequestChanges === -1) {
    return false;
  }

  return lastRequestChanges > lowerReport.lastIndexOf('approve');
}

describe('OpenSpec hygiene', () => {
  it('keeps canonical specs traceable and free of placeholder purposes', () => {
    const specFiles = readdirSync(specsDir)
      .map((name) => join(specsDir, name, 'spec.md'))
      .filter((path) => existsSync(path));

    expect(specFiles.length).toBeGreaterThan(0);

    for (const specPath of specFiles) {
      const content = readText(specPath);
      const purposeMatch = content.match(/## Purpose\s+([\s\S]*?)\n## Requirements/);
      expect(purposeMatch, `${specPath} must have Purpose before Requirements`).not.toBeNull();

      const purpose = purposeMatch?.[1].trim() ?? '';
      expect(purpose, `${specPath} purpose must be non-empty`).not.toHaveLength(0);
      expect(purpose, `${specPath} purpose must not be generated placeholder`).not.toMatch(
        /\bTBD\b|created by archiving change|Update Purpose after archive/i,
      );
      expect(content, `${specPath} must retain upstream ID traceability`).toMatch(
        /\b(?:BR|NFR|D|A|AT|Q|T|H)-[A-Z0-9]+(?:\.\.[A-Z0-9]+)?\b/,
      );
    }
  });

  it('requires non-legacy archives to retain complete tasks and checker reports', () => {
    const archiveNames = readdirSync(archiveDir).filter((name) =>
      statSync(join(archiveDir, name)).isDirectory(),
    );

    const checkedArchives = archiveNames.filter((name) => !legacyArchiveAllowlist.has(name));
    expect(checkedArchives.length).toBeGreaterThan(0);

    for (const archiveName of checkedArchives) {
      const archivePath = join(archiveDir, archiveName);
      const tasksPath = join(archivePath, 'tasks.md');
      const verificationPath = join(archivePath, 'verification.md');
      const reviewPath = join(archivePath, 'review.md');

      expect(existsSync(tasksPath), `${archiveName} must retain tasks.md`).toBe(true);
      expect(existsSync(verificationPath), `${archiveName} must retain verification.md`).toBe(true);
      expect(existsSync(reviewPath), `${archiveName} must retain review.md`).toBe(true);

      const tasks = readText(tasksPath);
      const verification = readText(verificationPath);
      const review = readText(reviewPath);

      expect(tasks, `${archiveName} must retain at least one completed task`).toMatch(/^- \[x\]/m);
      expect(tasks, `${archiveName} must not retain unchecked tasks`).not.toMatch(/^- \[ \]/m);
      expect(
        verification.trim(),
        `${archiveName} verification.md must not be empty`,
      ).not.toHaveLength(0);
      expect(verification, `${archiveName} verification.md must record PASS verdict`).toSatisfy(
        hasVerifierPass,
      );
      expect(review.trim(), `${archiveName} review.md must not be empty`).not.toHaveLength(0);
      expect(review, `${archiveName} review.md must record APPROVE verdict`).toSatisfy(
        hasReviewerApprove,
      );
      expect(
        review,
        `${archiveName} review.md must not leave REQUEST CHANGES unresolved`,
      ).not.toSatisfy(hasUnresolvedRequestChanges);
    }
  });

  it('keeps legacy evidence gaps explicit instead of retroactively certifying them', () => {
    const state = readText(join(repoRoot, 'docs', 'state.md'));
    expect(state).toContain('all 11 archives lack committed verifier/reviewer reports');
    expect(state).toContain('R-11 was archived with every task unchecked');
  });
});
