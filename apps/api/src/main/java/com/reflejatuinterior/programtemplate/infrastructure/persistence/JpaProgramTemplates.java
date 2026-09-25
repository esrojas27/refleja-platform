package com.reflejatuinterior.programtemplate.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.programtemplate.application.ProgramTemplateSnapshot;
import com.reflejatuinterior.programtemplate.application.ProgramTemplates;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaProgramTemplates implements ProgramTemplates {
    private final ProgramTemplateJpaRepository repository;
    private final ObjectMapper json;

    JpaProgramTemplates(ProgramTemplateJpaRepository repository, ObjectMapper json) {
        this.repository = repository;
        this.json = json;
    }

    @Override
    public Stored create(UUID sourceOrganizationId, UUID sourceProgramId, UUID createdByUserId,
            String name, String description, ProgramTemplateSnapshot snapshot) {
        try {
            return data(repository.saveAndFlush(new ProgramTemplateJpaEntity(sourceOrganizationId, sourceProgramId,
                    createdByUserId, name, description, json.writeValueAsString(snapshot))));
        } catch (tools.jackson.core.JacksonException exception) {
            throw new IllegalStateException("Could not serialize program template", exception);
        }
    }

    @Override
    public Page list(int page, int size) {
        var result = repository.findAll(PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        return new Page(result.getContent().stream().map(this::data).toList(), page, size,
                result.getTotalElements(), result.getTotalPages());
    }

    @Override
    public Optional<Stored> find(UUID templateId) {
        return repository.findById(templateId).map(this::data);
    }

    private Stored data(ProgramTemplateJpaEntity entity) {
        try {
            return new Stored(entity.id(), entity.sourceOrganizationId(), entity.sourceProgramId(), entity.name(),
                    entity.description(), json.readValue(entity.snapshot(), ProgramTemplateSnapshot.class),
                    entity.createdAt(), entity.version());
        } catch (tools.jackson.core.JacksonException exception) {
            throw new IllegalStateException("Could not deserialize program template", exception);
        }
    }
}
