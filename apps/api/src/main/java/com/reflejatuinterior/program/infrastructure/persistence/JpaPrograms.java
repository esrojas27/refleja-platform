package com.reflejatuinterior.program.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.program.application.ProgramData;
import com.reflejatuinterior.program.application.ProgramPage;
import com.reflejatuinterior.program.application.Programs;
import com.reflejatuinterior.program.domain.NewProgram;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaPrograms implements Programs {
    private final ProgramJpaRepository repository;
    JpaPrograms(ProgramJpaRepository repository) { this.repository = repository; }

    @Override public ProgramData create(UUID organizationId, NewProgram input) {
        return data(repository.saveAndFlush(new ProgramJpaEntity(organizationId, input.name(), input.description(),
                ProgramStatus.valueOf(input.initialStatus()), input.startDate(), input.endDate(), null)));
    }

    @Override public ProgramPage list(UUID organizationId, int page, int size) {
        // Fixed deterministic ordering; the existing (organization_id, id) unique index supports it.
        var result = repository.findByOrganizationId(organizationId, PageRequest.of(page, size, Sort.by("id").descending()));
        return new ProgramPage(result.getContent().stream().map(JpaPrograms::data).toList(), page, size,
                result.getTotalElements(), result.getTotalPages());
    }

    @Override public Optional<ProgramData> find(UUID organizationId, UUID programId) {
        return repository.findByOrganizationIdAndId(organizationId, programId).map(JpaPrograms::data);
    }

    private static ProgramData data(ProgramJpaEntity entity) {
        return new ProgramData(entity.id(), entity.organizationId(), entity.name(), entity.description(),
                entity.status().name(), entity.startDate(), entity.endDate(), entity.version());
    }
}
