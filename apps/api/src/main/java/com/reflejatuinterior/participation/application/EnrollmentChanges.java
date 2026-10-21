package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface EnrollmentChanges {
    record Entry(UUID id, UUID programId, String action, String previousStatus, String status, Set<String> previousRoles,
            Set<String> roles, UUID previousInvitationId, UUID invitationId, UUID actorId,
            String actorLabel, String reason, String requestId, long version, Instant recordedAt) {}
    record Page(List<Entry> items, int page, int size, long totalElements, int totalPages) {}
    void record(Enrollments.Data previous, Enrollments.Data current, String action,
            Set<String> previousRoles, Set<String> roles, UUID actorId, String actorLabel, String reason, String requestId);
    Page list(UUID org, UUID program, UUID enrollment, int page, int size);
}
