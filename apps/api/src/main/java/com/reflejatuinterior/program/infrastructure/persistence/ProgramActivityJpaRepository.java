package com.reflejatuinterior.program.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ProgramActivityJpaRepository extends JpaRepository<ProgramActivityJpaEntity, UUID> {
    List<ProgramActivityJpaEntity> findByOrganizationIdAndProgramIdOrderBySessionIdAscPositionAscIdAsc(
            UUID organizationId, UUID programId);
    List<ProgramActivityJpaEntity> findByOrganizationIdAndProgramIdAndIdIn(
            UUID organizationId, UUID programId, Collection<UUID> ids);
}
