package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ActivityAssignmentJpaRepository extends JpaRepository<ActivityAssignmentJpaEntity, UUID> {
    List<ActivityAssignmentJpaEntity> findByOrganizationIdAndProgramIdAndActivityIdInOrderByActivityIdAscEnrollmentIdAsc(
            UUID organizationId, UUID programId, Collection<UUID> activityIds);
    List<ActivityAssignmentJpaEntity> findByOrganizationIdAndProgramIdAndEnrollmentIdOrderByActivityIdAsc(
            UUID organizationId, UUID programId, UUID enrollmentId);
}
