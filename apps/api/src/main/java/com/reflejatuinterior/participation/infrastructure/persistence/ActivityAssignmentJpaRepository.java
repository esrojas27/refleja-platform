package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;

interface ActivityAssignmentJpaRepository extends JpaRepository<ActivityAssignmentJpaEntity, UUID> {
    List<ActivityAssignmentJpaEntity> findByOrganizationIdAndProgramIdAndActivityIdInOrderByActivityIdAscEnrollmentIdAsc(
            UUID organizationId, UUID programId, Collection<UUID> activityIds);
    List<ActivityAssignmentJpaEntity> findByOrganizationIdAndProgramIdAndEnrollmentIdOrderByActivityIdAsc(
            UUID organizationId, UUID programId, UUID enrollmentId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ActivityAssignmentJpaEntity a where a.organizationId = :organizationId "
            + "and a.programId = :programId and a.activityId = :activityId and a.enrollmentId = :enrollmentId")
    Optional<ActivityAssignmentJpaEntity> lockOwned(UUID organizationId, UUID programId,
            UUID activityId, UUID enrollmentId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ActivityAssignmentJpaEntity a where a.organizationId = :organizationId "
            + "and a.programId = :programId and a.activityId = :activityId and a.id = :assignmentId")
    Optional<ActivityAssignmentJpaEntity> lockForReview(UUID organizationId, UUID programId,
            UUID activityId, UUID assignmentId);
}
