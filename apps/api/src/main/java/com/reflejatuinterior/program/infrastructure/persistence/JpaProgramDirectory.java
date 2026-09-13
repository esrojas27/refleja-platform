package com.reflejatuinterior.program.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.program.ProgramDirectory;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(readOnly = true)
class JpaProgramDirectory implements ProgramDirectory {
    private final ProgramJpaRepository programs;

    JpaProgramDirectory(ProgramJpaRepository programs) { this.programs = programs; }

    @Override public Optional<Summary> find(UUID organizationId, UUID programId) {
        return programs.findByOrganizationIdAndId(organizationId, programId)
                .map(p -> new Summary(p.id(), p.organizationId(), p.name()));
    }
}
