package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.Set;
import java.util.UUID;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import org.springframework.data.jpa.repository.JpaRepository;

interface EnrollmentJpaRepository extends JpaRepository<EnrollmentJpaEntity, UUID> {
    Page<EnrollmentJpaEntity> findByOrganizationIdAndProgramId(UUID organizationId, UUID programId, Pageable pageable);
    Optional<EnrollmentJpaEntity> findByOrganizationIdAndProgramIdAndId(UUID organizationId, UUID programId, UUID id);
    Optional<EnrollmentJpaEntity> findByOrganizationIdAndInvitationId(UUID organizationId, UUID invitationId);
    Page<EnrollmentJpaEntity> findByParticipantMembershipIdInAndStatusIn(
            Set<UUID> membershipIds, Set<EnrollmentStatus> statuses, Pageable pageable);
    Optional<EnrollmentJpaEntity> findFirstByParticipantMembershipIdInAndProgramIdAndStatusIn(
            Set<UUID> membershipIds, UUID programId, Set<EnrollmentStatus> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from EnrollmentJpaEntity e where e.organizationId = :organizationId and e.invitationId = :invitationId")
    Optional<EnrollmentJpaEntity> lockByInvitation(UUID organizationId, UUID invitationId);
}
