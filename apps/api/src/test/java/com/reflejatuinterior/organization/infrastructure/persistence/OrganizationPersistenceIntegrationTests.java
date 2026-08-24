package com.reflejatuinterior.organization.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class OrganizationPersistenceIntegrationTests extends PostgreSqlIntegrationTestSupport {

    @Autowired
    OrganizationJpaRepository repository;

    @Test
    void persistsAnOrganizationWithAUuidVersion7AndSymbolicStatus() {
        OrganizationJpaEntity organization = repository.saveAndFlush(
                new OrganizationJpaEntity(
                        "Refleja Tu Interior",
                        "refleja-tu-interior",
                        OrganizationStatus.ACTIVE,
                        null,
                        "America/Bogota"));

        assertThat(organization.id()).isNotNull();
        assertThat(organization.id().version()).isEqualTo(7);
        assertThat(organization.status()).isEqualTo(OrganizationStatus.ACTIVE);
        assertThat(organization.defaultTimeZone()).isEqualTo("America/Bogota");
        assertThat(organization.version()).isZero();
        assertThat(repository.findById(organization.id())).containsSame(organization);
        assertThat(jdbcTemplate.queryForObject(
                "select status from rti.organizations where id = ?",
                String.class,
                organization.id()))
                .isEqualTo("ACTIVE");
    }
}
