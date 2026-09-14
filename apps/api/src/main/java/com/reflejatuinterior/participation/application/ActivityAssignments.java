package com.reflejatuinterior.participation.application;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;
import com.reflejatuinterior.participation.domain.ActivityReviewDecision;

public interface ActivityAssignments {
    List<Data> create(UUID organizationId, UUID programId, UUID activityId, Collection<UUID> enrollmentIds);
    List<Data> listByActivities(UUID organizationId, UUID programId, Collection<UUID> activityIds);
    List<Data> listOwned(UUID organizationId, UUID programId, UUID enrollmentId);
    Optional<Data> submit(UUID organizationId, UUID programId, UUID activityId, UUID enrollmentId,
            String responseText);
    Optional<Data> review(UUID organizationId, UUID programId, UUID activityId, UUID assignmentId,
            ActivityReviewDecision decision, String comment, UUID reviewerId);

    record Data(UUID id, UUID organizationId, UUID programId, UUID activityId, UUID enrollmentId,
                String status, String responseText, Instant submittedAt, String reviewComment,
                Instant reviewedAt, UUID reviewedBy, long version) {}
}
