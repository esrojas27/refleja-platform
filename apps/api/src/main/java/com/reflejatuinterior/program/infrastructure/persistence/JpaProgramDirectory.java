package com.reflejatuinterior.program.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.EntityManager;
import com.reflejatuinterior.program.ProgramDirectory;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

@Repository
@Transactional(readOnly = true)
class JpaProgramDirectory implements ProgramDirectory {
    private final ProgramJpaRepository programs;
    private final EntityManager entityManager;

    JpaProgramDirectory(ProgramJpaRepository programs, EntityManager entityManager) {
        this.programs = programs; this.entityManager = entityManager;
    }

    @Override public Optional<Summary> find(UUID organizationId, UUID programId) {
        return programs.findByOrganizationIdAndId(organizationId, programId)
                .map(p -> new Summary(p.id(), p.organizationId(), p.name(), p.description(), p.status().name(),
                        p.startDate(), p.endDate(), p.version(), p.activated()));
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public Optional<Summary> lock(UUID organizationId, UUID programId) {
        return programs.lockByOrganizationIdAndId(organizationId, programId)
                .map(p -> {
                    entityManager.refresh(p);
                    return new Summary(p.id(), p.organizationId(), p.name(), p.description(), p.status().name(),
                            p.startDate(), p.endDate(), p.version(), p.activated());
                });
    }
}
