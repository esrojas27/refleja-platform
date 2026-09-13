package com.reflejatuinterior.organization.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import java.util.UUID;

import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

class TenantIsolationIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID organizationA = uuid7(0xc01);
    private final UUID organizationB = uuid7(0xc02);
    private final UUID userA = uuid7(0xc03);
    private final UUID userB = uuid7(0xc04);
    private final UUID membershipA = uuid7(0xc05);
    private final UUID membershipB = uuid7(0xc06);
    private final UUID programA = uuid7(0xc07);
    private final UUID programB = uuid7(0xc08);
    private final UUID enrollmentA = uuid7(0xc09);
    private final UUID enrollmentB = uuid7(0xc0a);
    private final UUID moduleA = uuid7(0xc0b);
    private final UUID moduleB = uuid7(0xc0c);
    private final UUID sessionA = uuid7(0xc0d);
    private final UUID sessionB = uuid7(0xc0e);

    @Autowired
    OrganizationTenantContext tenantContext;

    @Autowired
    PlatformTransactionManager transactionManager;

    private TransactionTemplate transactions;

    @BeforeEach
    void fixture() {
        transactions = new TransactionTemplate(transactionManager);
        var admin = migratorJdbcTemplate();
        admin.update("delete from rti.program_sessions where organization_id in (?, ?)", organizationA, organizationB);
        admin.update("delete from rti.program_modules where organization_id in (?, ?)", organizationA, organizationB);
        admin.update("delete from rti.enrollments where organization_id in (?, ?)", organizationA, organizationB);
        admin.update("delete from rti.programs where organization_id in (?, ?)", organizationA, organizationB);
        admin.update("delete from rti.membership_roles where membership_id in (?, ?)", membershipA, membershipB);
        admin.update("delete from rti.organization_memberships where id in (?, ?)", membershipA, membershipB);
        admin.update("delete from rti.users where id in (?, ?)", userA, userB);
        admin.update("delete from rti.organizations where id in (?, ?)", organizationA, organizationB);

        insertOrganization(organizationA);
        insertOrganization(organizationB);
        insertUser(userA);
        insertUser(userB);
        insertMembership(membershipA, organizationA, userA);
        insertMembership(membershipB, organizationB, userB);
        insertProgram(programA, organizationA);
        insertProgram(programB, organizationB);
        admin.update("""
                insert into rti.program_modules
                    (id, organization_id, program_id, name, position, created_at, updated_at, version)
                values (?, ?, ?, 'Module A', 1, now(), now(), 0),
                       (?, ?, ?, 'Module B', 1, now(), now(), 0)
                """, moduleA, organizationA, programA, moduleB, organizationB, programB);
        admin.update("""
                insert into rti.program_sessions
                    (id, organization_id, program_id, module_id, name, scheduled_date, position,
                     created_at, updated_at, version)
                values (?, ?, ?, ?, 'Session A', '2026-10-01', 1, now(), now(), 0),
                       (?, ?, ?, ?, 'Session B', '2026-10-01', 1, now(), now(), 0)
                """, sessionA, organizationA, programA, moduleA,
                sessionB, organizationB, programB, moduleB);
        admin.update("""
                insert into rti.enrollments
                    (id, organization_id, program_id, participant_membership_id, status,
                     created_at, updated_at, version)
                values (?, ?, ?, ?, 'ACTIVE', now(), now(), 0),
                       (?, ?, ?, ?, 'ACTIVE', now(), now(), 0)
                """,
                enrollmentA, organizationA, programA, membershipA,
                enrollmentB, organizationB, programB, membershipB);
    }

    @Test
    void runtimeRoleAndPoliciesSatisfyTheRlsBoundary() {
        Map<String, Object> role = jdbcTemplate.queryForMap(
                "select rolsuper, rolbypassrls from pg_roles where rolname = current_user");
        assertThat(role).containsEntry("rolsuper", false).containsEntry("rolbypassrls", false);

        var admin = migratorJdbcTemplate();
        assertThat(admin.queryForList("""
                select c.relname
                from pg_class c
                join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'rti'
                  and c.relname in ('programs', 'enrollments', 'program_modules', 'program_sessions')
                  and c.relrowsecurity
                order by c.relname
                """, String.class)).containsExactly("enrollments", "program_modules", "program_sessions", "programs");
        assertThat(admin.queryForList("""
                select policyname
                from pg_policies
                where schemaname = 'rti'
                  and tablename in ('programs', 'enrollments', 'program_modules', 'program_sessions')
                order by policyname
                """, String.class)).containsExactly("enrollments_tenant_isolation", "program_modules_tenant_isolation",
                        "program_sessions_tenant_isolation", "programs_tenant_isolation");
    }

    @Test
    void noTenantContextRevealsNoTenantRows() {
        assertThat(count("programs")).isZero();
        assertThat(count("enrollments")).isZero();
        assertThat(count("program_modules")).isZero();
        assertThat(count("program_sessions")).isZero();
    }

    @Test
    void transactionLocalContextShowsOnlyItsOrganizationAndDoesNotLeak() {
        transactions.executeWithoutResult(status -> {
            tenantContext.activate(organizationA);
            assertThat(count("programs")).isEqualTo(1);
            assertThat(countById("programs", programA)).isEqualTo(1);
            assertThat(countById("programs", programB)).isZero();
            assertThat(countById("enrollments", enrollmentA)).isEqualTo(1);
            assertThat(countById("enrollments", enrollmentB)).isZero();
            assertThat(countById("program_modules", moduleA)).isEqualTo(1);
            assertThat(countById("program_modules", moduleB)).isZero();
            assertThat(countById("program_sessions", sessionA)).isEqualTo(1);
            assertThat(countById("program_sessions", sessionB)).isZero();
        });

        assertThat(count("programs")).isZero();
        assertThat(count("enrollments")).isZero();
        assertThat(count("program_modules")).isZero();
        assertThat(count("program_sessions")).isZero();
    }

    @Test
    void uuidManipulationCannotUpdateOrDeleteAnotherOrganizationsRows() {
        transactions.executeWithoutResult(status -> {
            tenantContext.activate(organizationA);
            assertThat(jdbcTemplate.update(
                    "update rti.programs set name = 'tampered' where id = ?", programB)).isZero();
            assertThat(jdbcTemplate.update(
                    "delete from rti.enrollments where id = ?", enrollmentB)).isZero();
            assertThat(jdbcTemplate.update(
                    "update rti.program_modules set name = 'tampered' where id = ?", moduleB)).isZero();
            assertThat(jdbcTemplate.update(
                    "delete from rti.program_sessions where id = ?", sessionB)).isZero();
        });

        var admin = migratorJdbcTemplate();
        assertThat(admin.queryForObject("select name from rti.programs where id = ?", String.class, programB))
                .isEqualTo("Program " + programB);
        assertThat(admin.queryForObject("select count(*) from rti.enrollments where id = ?", Long.class, enrollmentB))
                .isEqualTo(1);
        assertThat(admin.queryForObject("select name from rti.program_modules where id = ?", String.class, moduleB))
                .isEqualTo("Module B");
        assertThat(admin.queryForObject("select count(*) from rti.program_sessions where id = ?", Long.class, sessionB))
                .isEqualTo(1);
    }

    @Test
    void tenantContextRejectsRowsOwnedByAnotherOrganization() {
        assertThatThrownBy(() -> transactions.executeWithoutResult(status -> {
            tenantContext.activate(organizationA);
            jdbcTemplate.update("""
                    insert into rti.programs
                        (id, organization_id, name, status, created_at, updated_at, version)
                    values (?, ?, 'cross tenant', 'DRAFT', now(), now(), 0)
                    """, uuid7(0xc0b), organizationB);
        })).isInstanceOf(DataAccessException.class);
    }

    @Test
    void activatingTenantContextWithoutATransactionIsRejected() {
        assertThatThrownBy(() -> tenantContext.activate(organizationA))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Tenant context requires an active transaction");
    }

    private long count(String table) {
        return jdbcTemplate.queryForObject("select count(*) from rti." + table, Long.class);
    }

    private long countById(String table, UUID id) {
        return jdbcTemplate.queryForObject("select count(*) from rti." + table + " where id = ?", Long.class, id);
    }
}
