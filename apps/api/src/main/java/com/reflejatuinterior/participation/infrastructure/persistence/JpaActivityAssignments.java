package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.participation.application.ActivityAssignments;
import com.reflejatuinterior.participation.application.Notifications;
import com.reflejatuinterior.participation.application.Notifications.Kind;
import com.reflejatuinterior.participation.domain.ActivityReviewDecision;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaActivityAssignments implements ActivityAssignments {
    private final ActivityAssignmentJpaRepository repository;
    private final Notifications notifications;

    JpaActivityAssignments(ActivityAssignmentJpaRepository repository, Notifications notifications) {
        this.repository = repository; this.notifications = notifications;
    }

    @Override
    public List<Data> create(UUID organizationId, UUID programId, UUID activityId,
            Collection<UUID> enrollmentIds) {
        var entities = enrollmentIds.stream()
                .map(enrollmentId -> new ActivityAssignmentJpaEntity(
                        organizationId, programId, activityId, enrollmentId))
                .toList();
        var saved = repository.saveAllAndFlush(entities);
        saved.forEach(entity -> notifications.record(organizationId,entity.id(),Kind.ACTIVITY_ASSIGNED));
        return saved.stream().map(JpaActivityAssignments::data).toList();
    }

    @Override
    public List<Data> listByActivities(UUID organizationId, UUID programId, Collection<UUID> activityIds) {
        if (activityIds.isEmpty()) return List.of();
        return repository.findByOrganizationIdAndProgramIdAndActivityIdInOrderByActivityIdAscEnrollmentIdAsc(
                organizationId, programId, activityIds).stream().map(JpaActivityAssignments::data).toList();
    }

    @Override
    public List<Data> listOwned(UUID organizationId, UUID programId, UUID enrollmentId) {
        return repository.findByOrganizationIdAndProgramIdAndEnrollmentIdOrderByActivityIdAsc(
                organizationId, programId, enrollmentId).stream().map(JpaActivityAssignments::data).toList();
    }

    @Override
    public Optional<Data> submit(UUID organizationId, UUID programId, UUID activityId,
            UUID enrollmentId, String responseText) {
        return repository.lockOwned(organizationId, programId, activityId, enrollmentId).map(entity -> {
            entity.submit(responseText);
            var saved=repository.saveAndFlush(entity);
            notifications.record(organizationId,saved.id(),Kind.SUBMISSION_RECEIVED);
            notifications.record(organizationId,saved.id(),Kind.SURVEY_PENDING);
            return data(saved);
        });
    }

    @Override
    public Optional<Data> review(UUID organizationId, UUID programId, UUID activityId,
            UUID assignmentId, ActivityReviewDecision decision, String comment, UUID reviewerId) {
        return repository.lockForReview(organizationId, programId, activityId, assignmentId).map(entity -> {
            entity.review(decision, comment, reviewerId);
            var saved=repository.saveAndFlush(entity);
            notifications.record(organizationId,saved.id(),decision==ActivityReviewDecision.APPROVE
                    ? Kind.ACTIVITY_APPROVED : Kind.CHANGES_REQUESTED);
            return data(saved);
        });
    }

    private static Data data(ActivityAssignmentJpaEntity entity) {
        return new Data(entity.id(), entity.organizationId(), entity.programId(),
                entity.activityId(), entity.enrollmentId(), entity.status().name(), entity.responseText(),
                entity.submittedAt(), entity.reviewComment(), entity.reviewedAt(), entity.reviewedBy(), entity.version());
    }
}
