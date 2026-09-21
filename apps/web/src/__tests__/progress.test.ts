import { describe, expect, it } from "vitest";
import { collaboratorProgress, consultantProgress, isActivityOverdue } from "@/lib/participation/progress";
import type { AssignedActivity, ProgramActivity } from "@/lib/participation/activity-api";

const base = {
  id: "activity-a", organizationId: "org-a", programId: "program-a", moduleId: "dimension-a",
  sessionId: "session-a", dimensionName: "Interior", sessionName: "Autoconocimiento",
  title: "Reflexión", instructions: "Describe", youtubeUrl: null, dueDate: "2026-09-19",
  position: 1, version: 0,
};

describe("progress calculation", () => {
  it("derives collaborator totals and groups without persisting percentages", () => {
    const activities: AssignedActivity[] = [
      { ...base, assignmentId: "one", assignmentStatus: "COMPLETED", responseText: "Lista",
        submittedAt: null, reviewComment: null, reviewedAt: null, assignmentVersion: 1,
        survey: null, completionPercentage: 100 },
      { ...base, id: "activity-b", sessionId: "session-b", sessionName: "Propósito", dueDate: "2026-09-18",
        assignmentId: "two", assignmentStatus: "ASSIGNED", responseText: null,
        submittedAt: null, reviewComment: null, reviewedAt: null, assignmentVersion: 0,
        survey: null, completionPercentage: 0 },
    ];

    const progress = collaboratorProgress(activities, "2026-09-20");
    expect(progress).toMatchObject({ total: 2, completed: 1, pending: 1, overdue: 1, percentage: 50 });
    expect(progress.dimensions[0]).toMatchObject({ name: "Interior", total: 2, percentage: 50 });
    expect(progress.dimensions[0].sessions).toHaveLength(2);
  });

  it("keeps overdue as an additional alert and orders participants needing attention first", () => {
    const activities: ProgramActivity[] = [{ ...base, assignees: [
      { assignmentId: "one", enrollmentId: "enrollment-a", email: "ana@example.test", firstName: "Ana",
        lastName: null, status: "SUBMITTED", responseText: "Lista", submittedAt: null,
        reviewComment: null, reviewedAt: null, surveyStatus: "NOT_REQUIRED", completionPercentage: 100, version: 1 },
      { assignmentId: "two", enrollmentId: "enrollment-b", email: "bea@example.test", firstName: "Bea",
        lastName: null, status: "COMPLETED", responseText: "Lista", submittedAt: null,
        reviewComment: null, reviewedAt: null, surveyStatus: "NOT_REQUIRED", completionPercentage: 100, version: 1 },
    ] }];

    const progress = consultantProgress(activities, "2026-09-20");
    expect(progress.program).toMatchObject({ total: 2, inReview: 1, completed: 1, overdue: 1, percentage: 50 });
    expect(progress.participants.map(item => item.name)).toEqual(["Ana", "Bea"]);
    expect(isActivityOverdue("2026-09-19", "SUBMITTED", "2026-09-20")).toBe(true);
    expect(isActivityOverdue("2026-09-19", "COMPLETED", "2026-09-20")).toBe(false);
  });
});
