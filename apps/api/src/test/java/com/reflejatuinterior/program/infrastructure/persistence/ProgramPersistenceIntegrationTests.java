package com.reflejatuinterior.program.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.UUID;

import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProgramPersistenceIntegrationTests extends PostgreSqlIntegrationTestSupport {

    @Autowired
    ProgramJpaRepository repository;

    @Test
    void persistsAProgramWithScalarTenantAndMembershipReferences() {
        UUID organizationId = uuid7(200);
        UUID userId = uuid7(201);
        UUID consultantMembershipId = uuid7(202);
        insertOrganization(organizationId);
        insertUser(userId);
        insertMembership(consultantMembershipId, organizationId, userId);

        ProgramJpaEntity program = repository.saveAndFlush(new ProgramJpaEntity(
                organizationId,
                "Initial program",
                "Persistence integration fixture",
                ProgramStatus.DRAFT,
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2026, 12, 1),
                consultantMembershipId));

        assertThat(program.id().version()).isEqualTo(7);
        assertThat(program.organizationId()).isEqualTo(organizationId);
        assertThat(program.status()).isEqualTo(ProgramStatus.DRAFT);
        assertThat(program.startDate()).isEqualTo(LocalDate.of(2026, 9, 1));
        assertThat(program.version()).isZero();
        assertThat(repository.findById(program.id())).containsSame(program);
    }

    @Test
    void rejectsAPrimaryConsultantMembershipFromAnotherOrganization() {
        UUID programOrganizationId = uuid7(203);
        UUID otherOrganizationId = uuid7(204);
        UUID otherUserId = uuid7(205);
        UUID otherMembershipId = uuid7(206);
        insertOrganization(programOrganizationId);
        insertOrganization(otherOrganizationId);
        insertUser(otherUserId);
        insertMembership(otherMembershipId, otherOrganizationId, otherUserId);

        assertThatThrownBy(() -> repository.saveAndFlush(new ProgramJpaEntity(
                programOrganizationId,
                "Invalid cross-tenant program",
                null,
                ProgramStatus.DRAFT,
                null,
                null,
                otherMembershipId)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
