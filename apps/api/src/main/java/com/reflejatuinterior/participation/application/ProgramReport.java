package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Read-only report. Never includes DISC, profile fields or private activity submission text. */
public record ProgramReport(UUID organizationId, String organizationName, UUID programId, String programName,
        String programStatus, LocalDate startDate, LocalDate endDate, Instant generatedAt, String timeZone,
        LocalDate asOfDate, UUID enrollmentId, Summary summary, Map<String, Long> enrollmentCounts,
        List<Participant> participants, List<Work> work, SurveyResults surveys) {
    public record Summary(int participantCount, int participatingCount, int assigned, int submitted,
            int pending, int inReview, int changesRequested, int approved, int overdue,
            int surveysAssigned, int surveysCompleted, int due, int onTime,
            Double progressPercentage, Double approvalPercentage, Double participationPercentage,
            Double onTimePercentage) {}
    public record Participant(UUID enrollmentId, String name, String email, String status, Summary summary) {}
    public record Work(UUID assignmentId, UUID enrollmentId, UUID activityId, String activityTitle,
            UUID dimensionId, String dimensionName, UUID sessionId, String sessionName,
            LocalDate dueDate, String status, Instant submittedAt, boolean surveyRequired,
            Instant surveyCompletedAt, int progressPercentage, boolean overdue, boolean onTime,double sessionProgressPercentage) {}
}
