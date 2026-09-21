package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ActivityEvaluationJpaRepository extends JpaRepository<ActivityEvaluationJpaEntity, UUID> {
    List<ActivityEvaluationJpaEntity> findByOrganizationIdAndProgramIdOrderByActivityIdAsc(
            UUID organizationId, UUID programId);
    Optional<ActivityEvaluationJpaEntity> findByOrganizationIdAndProgramIdAndActivityId(
            UUID organizationId, UUID programId, UUID activityId);
}
