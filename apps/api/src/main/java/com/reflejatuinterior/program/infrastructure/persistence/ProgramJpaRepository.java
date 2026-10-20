package com.reflejatuinterior.program.infrastructure.persistence;

import java.util.UUID;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

interface ProgramJpaRepository extends JpaRepository<ProgramJpaEntity, UUID> {
    Optional<ProgramJpaEntity> findByOrganizationIdAndId(UUID organizationId, UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ProgramJpaEntity p where p.organizationId = :organizationId and p.id = :id")
    Optional<ProgramJpaEntity> lockByOrganizationIdAndId(UUID organizationId, UUID id);
    Page<ProgramJpaEntity> findByOrganizationId(UUID organizationId, Pageable pageable);
}
