package com.reflejatuinterior.program.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ProgramModuleJpaRepository extends JpaRepository<ProgramModuleJpaEntity, UUID> {
    List<ProgramModuleJpaEntity> findByOrganizationIdAndProgramIdOrderByPositionAscIdAsc(UUID organizationId, UUID programId);
    Optional<ProgramModuleJpaEntity> findByOrganizationIdAndProgramIdAndId(UUID organizationId, UUID programId, UUID id);
}
