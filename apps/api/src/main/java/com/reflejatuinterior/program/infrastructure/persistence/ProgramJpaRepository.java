package com.reflejatuinterior.program.infrastructure.persistence;

import java.util.UUID;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import org.springframework.data.jpa.repository.JpaRepository;

interface ProgramJpaRepository extends JpaRepository<ProgramJpaEntity, UUID> {
    Optional<ProgramJpaEntity> findByOrganizationIdAndId(UUID organizationId, UUID id);
    Page<ProgramJpaEntity> findByOrganizationId(UUID organizationId, Pageable pageable);
}
