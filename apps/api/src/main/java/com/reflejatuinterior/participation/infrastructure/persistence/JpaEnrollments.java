package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.List;
import java.util.Set;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.participation.application.EnrollmentNotFound;
import com.reflejatuinterior.participation.application.Enrollments;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaEnrollments implements Enrollments {
    private final EnrollmentJpaRepository repository;
    private final EntityManager entityManager;
    JpaEnrollments(EnrollmentJpaRepository repository, EntityManager entityManager) {
        this.repository = repository;
        this.entityManager = entityManager;
    }

    @Override public Data create(UUID organizationId, UUID programId, UUID membershipId, UUID invitationId) {
        var entity = new EnrollmentJpaEntity(organizationId, programId, membershipId, EnrollmentStatus.INVITED,
                null, null, null, null);
        entity.attachInvitation(invitationId);
        return data(repository.saveAndFlush(entity));
    }

    @Override public Page list(UUID organizationId, UUID programId, int page, int size) {
        var result = repository.findByOrganizationIdAndProgramId(organizationId, programId,
                PageRequest.of(page, size, Sort.by("id").descending()));
        return new Page(result.getContent().stream().map(JpaEnrollments::data).toList(), page, size,
                result.getTotalElements(), result.getTotalPages());
    }

    @Override public Optional<Data> find(UUID organizationId, UUID programId, UUID enrollmentId) {
        return repository.findByOrganizationIdAndProgramIdAndId(organizationId, programId, enrollmentId).map(JpaEnrollments::data);
    }

    @Override public Optional<Data> findByInvitation(UUID organizationId, UUID invitationId) {
        return repository.findByOrganizationIdAndInvitationId(organizationId, invitationId).map(JpaEnrollments::data);
    }

    @Override public Data activate(UUID organizationId, UUID invitationId) {
        var entity = repository.lockByInvitation(organizationId, invitationId).orElseThrow(EnrollmentNotFound::new);
        entity.activate();
        return data(repository.saveAndFlush(entity));
    }

    @Override public long countOwned(UUID organizationId, UUID membershipId) {
        return entityManager.createQuery("""
                select count(e) from EnrollmentJpaEntity e
                where e.organizationId = :organizationId
                  and e.participantMembershipId = :membershipId
                  and e.status in :statuses
                """, Long.class)
                .setParameter("organizationId", organizationId)
                .setParameter("membershipId", membershipId)
                .setParameter("statuses", Set.of(EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED))
                .getSingleResult();
    }

    @Override public List<Data> listOwned(UUID organizationId, UUID membershipId, int offset, int limit) {
        return entityManager.createQuery("""
                select e from EnrollmentJpaEntity e
                where e.organizationId = :organizationId
                  and e.participantMembershipId = :membershipId
                  and e.status in :statuses
                order by e.id desc
                """, EnrollmentJpaEntity.class)
                .setParameter("organizationId", organizationId)
                .setParameter("membershipId", membershipId)
                .setParameter("statuses", Set.of(EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED))
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList().stream().map(JpaEnrollments::data).toList();
    }

    @Override public Optional<Data> findOwned(UUID organizationId, UUID membershipId, UUID programId) {
        return entityManager.createQuery("""
                select e from EnrollmentJpaEntity e
                where e.organizationId = :organizationId
                  and e.participantMembershipId = :membershipId
                  and e.programId = :programId
                  and e.status in :statuses
                """, EnrollmentJpaEntity.class)
                .setParameter("organizationId", organizationId)
                .setParameter("membershipId", membershipId)
                .setParameter("programId", programId)
                .setParameter("statuses", Set.of(EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED))
                .setMaxResults(1)
                .getResultStream().findFirst().map(JpaEnrollments::data);
    }

    @Override public List<Data> findActive(UUID organizationId, UUID programId, Collection<UUID> enrollmentIds) {
        if (enrollmentIds.isEmpty()) return List.of();
        return entityManager.createQuery("""
                select e from EnrollmentJpaEntity e
                where e.organizationId = :organizationId
                  and e.programId = :programId
                  and e.id in :enrollmentIds
                  and e.status = :status
                order by e.id
                """, EnrollmentJpaEntity.class)
                .setParameter("organizationId", organizationId)
                .setParameter("programId", programId)
                .setParameter("enrollmentIds", enrollmentIds)
                .setParameter("status", EnrollmentStatus.ACTIVE)
                .getResultList().stream().map(JpaEnrollments::data).toList();
    }

    @Override public List<Data> findAllActive(UUID organizationId, UUID programId) {
        return entityManager.createQuery("""
                select e from EnrollmentJpaEntity e
                where e.organizationId = :organizationId
                  and e.programId = :programId
                  and e.status = :status
                order by e.id
                """, EnrollmentJpaEntity.class)
                .setParameter("organizationId", organizationId)
                .setParameter("programId", programId)
                .setParameter("status", EnrollmentStatus.ACTIVE)
                .getResultList().stream().map(JpaEnrollments::data).toList();
    }

    private static Data data(EnrollmentJpaEntity e) {
        return new Data(e.id(), e.organizationId(), e.programId(), e.participantMembershipId(), e.invitationId(), e.status().name());
    }
}
