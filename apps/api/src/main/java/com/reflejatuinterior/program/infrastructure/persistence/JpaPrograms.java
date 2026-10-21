package com.reflejatuinterior.program.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.EntityManager;
import com.reflejatuinterior.program.ProgramDirectory;
import com.reflejatuinterior.program.application.ProgramData;
import com.reflejatuinterior.program.application.ProgramNotFound;
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
    private final EntityManager entityManager;
    JpaPrograms(ProgramJpaRepository repository, EntityManager entityManager) {
        this.repository = repository; this.entityManager = entityManager;
    }

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
    @Override public ProgramPage listExcluding(UUID org,int page,int size,java.util.Set<UUID> excluded) {
        if(excluded.isEmpty()) return list(org,page,size);
        var result=repository.findByOrganizationIdAndIdNotIn(org,excluded,PageRequest.of(page,size,Sort.by("id").descending()));
        return new ProgramPage(result.getContent().stream().map(JpaPrograms::data).toList(),page,size,result.getTotalElements(),result.getTotalPages());
    }

    @Override public ChangedStatus transition(UUID organizationId, UUID programId, String target, long expectedVersion) {
        var entity = repository.lockByOrganizationIdAndId(organizationId, programId)
                .orElseThrow(ProgramNotFound::new);
        // A previous read in this transaction must not hide a concurrent closure.
        entityManager.refresh(entity);
        var previous = entity.status().name();
        entity.transitionTo(ProgramStatus.valueOf(target), expectedVersion);
        return new ChangedStatus(previous, data(repository.saveAndFlush(entity)));
    }

    private static ProgramData data(ProgramJpaEntity entity) {
        return new ProgramData(entity.id(), entity.organizationId(), entity.name(), entity.description(),
                entity.status().name(), entity.startDate(), entity.endDate(), entity.version());
    }

    @Override public void requireEditable(UUID organizationId, UUID programId) {
        var entity = repository.lockByOrganizationIdAndId(organizationId, programId)
                .orElseThrow(ProgramNotFound::new);
        entityManager.refresh(entity);
        if (entity.status() == ProgramStatus.COMPLETED || entity.status() == ProgramStatus.CANCELLED) {
            throw new ProgramDirectory.StateConflict("PROGRAM_READ_ONLY");
        }
    }
}
