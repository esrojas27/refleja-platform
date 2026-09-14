package com.reflejatuinterior.program.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ProgramSessionJpaRepository extends JpaRepository<ProgramSessionJpaEntity, UUID> {
    List<ProgramSessionJpaEntity> findByOrganizationIdAndProgramIdOrderByModuleIdAscPositionAscIdAsc(UUID organizationId, UUID programId);
    Optional<ProgramSessionJpaEntity> findByOrganizationIdAndProgramIdAndId(UUID organizationId, UUID programId, UUID id);
}
