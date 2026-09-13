package com.reflejatuinterior.participation.infrastructure.persistence;

import java.util.Set;
import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.participation.application.EnrollmentNotFound;
import com.reflejatuinterior.participation.application.Enrollments;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JpaEnrollments implements Enrollments {
    private final EnrollmentJpaRepository repository;
    JpaEnrollments(EnrollmentJpaRepository repository) { this.repository = repository; }

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

    @Override public Page listOwned(Set<UUID> membershipIds, int page, int size) {
        var result = repository.findByParticipantMembershipIdInAndStatusIn(membershipIds,
                Set.of(EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED),
                PageRequest.of(page, size, Sort.by("id").descending()));
        return new Page(result.getContent().stream().map(JpaEnrollments::data).toList(), page, size,
                result.getTotalElements(), result.getTotalPages());
    }

    @Override public Optional<Data> findOwned(Set<UUID> membershipIds, UUID programId) {
        return repository.findFirstByParticipantMembershipIdInAndProgramIdAndStatusIn(membershipIds, programId,
                Set.of(EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED)).map(JpaEnrollments::data);
    }

    private static Data data(EnrollmentJpaEntity e) {
        return new Data(e.id(), e.organizationId(), e.programId(), e.participantMembershipId(), e.invitationId(), e.status().name());
    }
}
