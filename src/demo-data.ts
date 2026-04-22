import { buildSignalSnapshotFromFacts } from "./activation/adapters";
import { readActivationStatus } from "./activation/api";
import type { ActivationSubjectRef } from "./activation/domain";
import { deriveActivationStatus } from "./activation/service";
import {
  InMemoryActivationMilestoneRepository,
  InMemoryActivationSignalRepository,
  InMemoryActivationStatusReadModelRepository,
} from "./activation/repositories";
import { buildActivationSummaryCard } from "./activation/view-model";

const subjects: ActivationSubjectRef[] = [
  { workspaceId: "alpha", subjectType: "workspace", subjectId: "alpha" },
  { workspaceId: "beta", subjectType: "workspace", subjectId: "beta" },
  { workspaceId: "gamma", subjectType: "workspace", subjectId: "gamma" },
];

export const signalRepository = new InMemoryActivationSignalRepository();
export const milestoneRepository = new InMemoryActivationMilestoneRepository();
export const readModelRepository = new InMemoryActivationStatusReadModelRepository();

seed();

export async function getAllActivationSummaries() {
  const results = [];

  for (const subject of subjects) {
    const response = await readActivationStatus(
      {
        signals: signalRepository,
        milestones: milestoneRepository,
        derive: deriveActivationStatus,
        readModel: readModelRepository,
      },
      { subject },
    );

    results.push({
      subject,
      status: response.status,
      summary: buildActivationSummaryCard(response.status),
    });
  }

  return results;
}

export async function getActivationSummaryByWorkspaceId(workspaceId: string) {
  const subject = subjects.find((entry) => entry.workspaceId === workspaceId);
  if (!subject) return null;

  const response = await readActivationStatus(
    {
      signals: signalRepository,
      milestones: milestoneRepository,
      derive: deriveActivationStatus,
      readModel: readModelRepository,
    },
    { subject },
  );

  return {
    subject,
    status: response.status,
    summary: buildActivationSummaryCard(response.status),
  };
}

function seed() {
  signalRepository.setSnapshot(
    subjects[0],
    buildSignalSnapshotFromFacts({
      now: now(),
      createdAt: daysAgo(9),
      briefCapturedAt: daysAgo(9),
      requirementsDefinedAt: daysAgo(7),
      planDefinedAt: daysAgo(7),
      implementationStartedAt: daysAgo(4),
      testsPassedAt: daysAgo(1),
      blockerCount: 0,
      dependencyBlockerCount: 0,
      openQuestionCount: 1,
      criticalIssueCount: 0,
      scopeChangeCount: 1,
      failedValidationCount: 0,
      retryCount: 1,
    }),
  );

  signalRepository.setSnapshot(
    subjects[1],
    buildSignalSnapshotFromFacts({
      now: now(),
      createdAt: daysAgo(14),
      briefCapturedAt: daysAgo(14),
      requirementsDefinedAt: daysAgo(11),
      planDefinedAt: daysAgo(10),
      implementationStartedAt: daysAgo(6),
      blockerCount: 2,
      dependencyBlockerCount: 1,
      openQuestionCount: 3,
      criticalIssueCount: 1,
      scopeChangeCount: 2,
      failedValidationCount: 1,
      retryCount: 2,
    }),
  );

  signalRepository.setSnapshot(
    subjects[2],
    buildSignalSnapshotFromFacts({
      now: now(),
      createdAt: daysAgo(30),
      briefCapturedAt: daysAgo(30),
      requirementsDefinedAt: daysAgo(28),
      planDefinedAt: daysAgo(28),
      implementationStartedAt: daysAgo(24),
      completedAt: daysAgo(12),
      testsPassedAt: daysAgo(11),
      validationPassedAt: daysAgo(10),
      releaseConfirmedAt: daysAgo(7),
      blockerCount: 0,
      dependencyBlockerCount: 0,
      openQuestionCount: 0,
      criticalIssueCount: 0,
      scopeChangeCount: 0,
      failedValidationCount: 0,
      retryCount: 0,
    }),
  );
}

function now() {
  return new Date().toISOString();
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
