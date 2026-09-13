package com.reflejatuinterior.participation.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;
import com.reflejatuinterior.organization.OrganizationTenantContext;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class EnrollmentPersistenceIntegrationTests extends PostgreSqlIntegrationTestSupport {

    @Autowired
    EnrollmentJpaRepository repository;

    @Autowired
    OrganizationTenantContext tenantContext;

    @Test
    void persistsAnEnrollmentWithScalarTenantReferences() {
        EnrollmentFixture fixture = insertEnrollmentFixture(300);
        tenantContext.activate(fixture.organizationId());

        EnrollmentJpaEntity enrollment = repository.saveAndFlush(new EnrollmentJpaEntity(
                fixture.organizationId(),
                fixture.programId(),
                fixture.membershipId(),
                EnrollmentStatus.ACTIVE,
                Instant.now(),
                Instant.now(),
                null,
                null));

        assertThat(enrollment.id().version()).isEqualTo(7);
        assertThat(enrollment.organizationId()).isEqualTo(fixture.organizationId());
        assertThat(enrollment.status()).isEqualTo(EnrollmentStatus.ACTIVE);
        assertThat(enrollment.version()).isZero();
        assertThat(repository.findById(enrollment.id())).containsSame(enrollment);
    }

    @Test
    void rejectsADuplicateEnrollmentForTheSameTenantProgramAndParticipant() {
        EnrollmentFixture fixture = insertEnrollmentFixture(310);
        tenantContext.activate(fixture.organizationId());
        repository.saveAndFlush(new EnrollmentJpaEntity(
                fixture.organizationId(),
                fixture.programId(),
                fixture.membershipId(),
                EnrollmentStatus.PENDING_APPROVAL,
                null,
                null,
                null,
                null));

        assertThatThrownBy(() -> repository.saveAndFlush(new EnrollmentJpaEntity(
                fixture.organizationId(),
                fixture.programId(),
                fixture.membershipId(),
                EnrollmentStatus.INVITED,
                null,
                null,
                null,
                null)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsAnEnrollmentWhoseProgramDoesNotExist() {
        UUID organizationId = uuid7(320);
        UUID userId = uuid7(321);
        UUID membershipId = uuid7(322);
        insertOrganization(organizationId);
        insertUser(userId);
        insertMembership(membershipId, organizationId, userId);
        tenantContext.activate(organizationId);

        assertThatThrownBy(() -> repository.saveAndFlush(new EnrollmentJpaEntity(
                organizationId,
                uuid7(323),
                membershipId,
                EnrollmentStatus.PENDING_APPROVAL,
                null,
                null,
                null,
                null)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsAParticipantMembershipFromAnotherOrganization() {
        UUID programOrganizationId = uuid7(330);
        UUID programId = uuid7(331);
        UUID otherOrganizationId = uuid7(332);
        UUID otherUserId = uuid7(333);
        UUID otherMembershipId = uuid7(334);
        insertOrganization(programOrganizationId);
        insertProgram(programId, programOrganizationId);
        insertOrganization(otherOrganizationId);
        insertUser(otherUserId);
        insertMembership(otherMembershipId, otherOrganizationId, otherUserId);
        tenantContext.activate(programOrganizationId);

        assertThatThrownBy(() -> repository.saveAndFlush(new EnrollmentJpaEntity(
                programOrganizationId,
                programId,
                otherMembershipId,
                EnrollmentStatus.PENDING_APPROVAL,
                null,
                null,
                null,
                null)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private EnrollmentFixture insertEnrollmentFixture(int suffix) {
        UUID organizationId = uuid7(suffix);
        UUID userId = uuid7(suffix + 1);
        UUID membershipId = uuid7(suffix + 2);
        UUID programId = uuid7(suffix + 3);
        insertOrganization(organizationId);
        insertUser(userId);
        insertMembership(membershipId, organizationId, userId);
        insertProgram(programId, organizationId);
        return new EnrollmentFixture(organizationId, programId, membershipId);
    }

    private record EnrollmentFixture(
            UUID organizationId,
            UUID programId,
            UUID membershipId) {
    }
}
