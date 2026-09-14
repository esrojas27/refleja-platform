package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.participation.application.ActivityAssignments;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaActivityAssignments implements ActivityAssignments {
    private final ActivityAssignmentJpaRepository repository;

    JpaActivityAssignments(ActivityAssignmentJpaRepository repository) { this.repository = repository; }

    @Override
    public List<Data> create(UUID organizationId, UUID programId, UUID activityId,
            Collection<UUID> enrollmentIds) {
        var entities = enrollmentIds.stream()
                .map(enrollmentId -> new ActivityAssignmentJpaEntity(
                        organizationId, programId, activityId, enrollmentId))
                .toList();
        return repository.saveAllAndFlush(entities).stream().map(JpaActivityAssignments::data).toList();
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

    private static Data data(ActivityAssignmentJpaEntity entity) {
        return new Data(entity.id(), entity.organizationId(), entity.programId(),
                entity.activityId(), entity.enrollmentId());
    }
}
