package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ActivityEvaluationResponseJpaRepository extends JpaRepository<ActivityEvaluationResponseJpaEntity, UUID> {
    boolean existsByOrganizationIdAndProgramIdAndActivityIdIn(UUID organizationId, UUID programId, Collection<UUID> activityIds);
    Optional<ActivityEvaluationResponseJpaEntity> findByOrganizationIdAndProgramIdAndAssignmentId(
            UUID organizationId, UUID programId, UUID assignmentId);
    List<ActivityEvaluationResponseJpaEntity> findByOrganizationIdAndProgramIdAndAssignmentIdIn(
            UUID organizationId, UUID programId, Collection<UUID> assignmentIds);
}
