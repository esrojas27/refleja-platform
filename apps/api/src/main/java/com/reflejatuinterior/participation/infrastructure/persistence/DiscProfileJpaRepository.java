package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

interface DiscProfileJpaRepository extends JpaRepository<DiscProfileJpaEntity, UUID> {
    List<DiscProfileJpaEntity> findByOrganizationIdAndProgramIdAndEnrollmentIdInOrderByEnrollmentId(
            UUID organizationId, UUID programId, Iterable<UUID> enrollmentIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select p from DiscProfileJpaEntity p
            where p.organizationId = :organizationId and p.programId = :programId
              and p.enrollmentId = :enrollmentId
            """)
    Optional<DiscProfileJpaEntity> lock(@Param("organizationId") UUID organizationId,
            @Param("programId") UUID programId, @Param("enrollmentId") UUID enrollmentId);
}
