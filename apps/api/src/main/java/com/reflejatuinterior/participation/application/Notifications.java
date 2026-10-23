package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface Notifications {
    enum Kind { ACTIVITY_ASSIGNED, SUBMISSION_RECEIVED, CHANGES_REQUESTED, ACTIVITY_APPROVED, SURVEY_PENDING, SESSION_RESCHEDULED }
    void record(UUID organizationId, UUID assignmentId, Kind kind);
    List<Item> list(UUID organizationId, UUID userId, Instant before, UUID beforeId, int limit);
    long unreadCount(UUID organizationId, UUID userId);
    boolean markRead(UUID organizationId, UUID userId, UUID id);
    record Item(UUID id, UUID organizationId, String organizationName, UUID programId, String programName,
                UUID activityId, String activityTitle, UUID assignmentId, Kind kind, String participantName,
                Instant createdAt, Instant readAt, UUID sessionId, java.time.LocalDate previousDate, java.time.LocalDate scheduledDate, String reason) {}
}
