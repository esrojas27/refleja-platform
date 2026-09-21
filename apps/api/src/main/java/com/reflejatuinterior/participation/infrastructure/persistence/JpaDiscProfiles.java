package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.participation.application.DiscProfileConflict;
import com.reflejatuinterior.participation.application.DiscProfiles;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaDiscProfiles implements DiscProfiles {
    private final DiscProfileJpaRepository repository;
    private final EntityManager entityManager;

    JpaDiscProfiles(DiscProfileJpaRepository repository, EntityManager entityManager) {
        this.repository = repository; this.entityManager = entityManager;
    }

    @Override public List<Data> findAll(UUID organizationId, UUID programId, Collection<UUID> enrollmentIds) {
        if (enrollmentIds.isEmpty()) return List.of();
        return repository.findByOrganizationIdAndProgramIdAndEnrollmentIdInOrderByEnrollmentId(
                organizationId, programId, enrollmentIds).stream().map(JpaDiscProfiles::data).toList();
    }

    @Override public Data save(UUID organizationId, UUID programId, UUID enrollmentId, Texts texts,
            Long expectedVersion, UUID actorId) {
        var found = repository.lock(organizationId, programId, enrollmentId);
        boolean created = found.isEmpty();
        DiscProfileJpaEntity entity;
        if (created) {
            if (expectedVersion != null) throw new DiscProfileConflict();
            entity = new DiscProfileJpaEntity(organizationId, programId, enrollmentId,
                    texts.dominant(), texts.influential(), texts.serene(), texts.conscientious(), actorId);
        } else {
            entity = found.get();
            if (expectedVersion == null || entity.version() != expectedVersion) throw new DiscProfileConflict();
            entity.update(texts.dominant(), texts.influential(), texts.serene(), texts.conscientious(), actorId);
        }
        entity = repository.saveAndFlush(entity);
        entityManager.persist(new DiscProfileRevisionJpaEntity(entity, created ? "CREATED" : "UPDATED", actorId));
        entityManager.flush();
        return data(entity);
    }

    private static Data data(DiscProfileJpaEntity entity) {
        return new Data(entity.id(), entity.organizationId(), entity.programId(), entity.enrollmentId(),
                entity.dominant(), entity.influential(), entity.serene(), entity.conscientious(),
                entity.createdBy(), entity.updatedBy(), entity.createdAt(), entity.updatedAt(), entity.version());
    }
}
