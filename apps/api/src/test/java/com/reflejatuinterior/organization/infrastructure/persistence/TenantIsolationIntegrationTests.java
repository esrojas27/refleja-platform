package com.reflejatuinterior.organization.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import java.util.UUID;

import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import org.junit.jupiter.api.AfterEach;
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
    private final UUID activityA = uuid7(0xc0f);
    private final UUID activityB = uuid7(0xc10);
    private final UUID assignmentA = uuid7(0xc11);
    private final UUID assignmentB = uuid7(0xc12);
    private final UUID discProfileA = uuid7(0xc13);
    private final UUID discProfileB = uuid7(0xc14);
    private final UUID discRevisionA = uuid7(0xc15);
    private final UUID discRevisionB = uuid7(0xc16);

    @Autowired
    OrganizationTenantContext tenantContext;

    @Autowired
    PlatformTransactionManager transactionManager;

    private TransactionTemplate transactions;

    @BeforeEach
    void fixture() {
        transactions = new TransactionTemplate(transactionManager);
        cleanFixtures();
        var admin = migratorJdbcTemplate();

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
        admin.update("""
                insert into rti.program_activities
                    (id, organization_id, program_id, module_id, session_id, title, instructions, due_date,
                     position, created_at, updated_at, version)
                values (?, ?, ?, ?, ?, 'Activity A', 'Instructions A', '2026-10-08', 1, now(), now(), 0),
                       (?, ?, ?, ?, ?, 'Activity B', 'Instructions B', '2026-10-08', 1, now(), now(), 0)
                """, activityA, organizationA, programA, moduleA, sessionA,
                activityB, organizationB, programB, moduleB, sessionB);
        admin.update("""
                insert into rti.activity_assignments
                    (id, organization_id, program_id, activity_id, enrollment_id, assigned_at, status,
                     created_at, updated_at, version)
                values (?, ?, ?, ?, ?, now(), 'ASSIGNED', now(), now(), 0),
                       (?, ?, ?, ?, ?, now(), 'ASSIGNED', now(), now(), 0)
                """, assignmentA, organizationA, programA, activityA, enrollmentA,
                assignmentB, organizationB, programB, activityB, enrollmentB);
        admin.update("""
                insert into rti.program_participant_disc_profiles
                    (id, organization_id, program_id, enrollment_id, dominant_text, influential_text,
                     serene_text, conscientious_text, created_by, updated_by, created_at, updated_at, version)
                values (?, ?, ?, ?, 'D-A', 'I-A', 'S-A', 'C-A', ?, ?, now(), now(), 0),
                       (?, ?, ?, ?, 'D-B', 'I-B', 'S-B', 'C-B', ?, ?, now(), now(), 0)
                """, discProfileA, organizationA, programA, enrollmentA, userA, userA,
                discProfileB, organizationB, programB, enrollmentB, userB, userB);
        admin.update("""
                insert into rti.program_participant_disc_profile_revisions
                    (id, profile_id, organization_id, program_id, enrollment_id, dominant_text,
                     influential_text, serene_text, conscientious_text, action, actor_id,
                     profile_version, recorded_at)
                values (?, ?, ?, ?, ?, 'D-A', 'I-A', 'S-A', 'C-A', 'CREATED', ?, 0, now()),
                       (?, ?, ?, ?, ?, 'D-B', 'I-B', 'S-B', 'C-B', 'CREATED', ?, 0, now())
                """, discRevisionA, discProfileA, organizationA, programA, enrollmentA, userA,
                discRevisionB, discProfileB, organizationB, programB, enrollmentB, userB);
    }

    @AfterEach
    void cleanFixtures() {
        var admin = migratorJdbcTemplate();
        admin.update("delete from rti.program_participant_disc_profile_revisions where organization_id in (?, ?)", organizationA, organizationB);
        admin.update("delete from rti.program_participant_disc_profiles where organization_id in (?, ?)", organizationA, organizationB);
        admin.update("delete from rti.activity_assignments where organization_id in (?, ?)", organizationA, organizationB);
        admin.update("delete from rti.program_activities where organization_id in (?, ?)", organizationA, organizationB);
        admin.update("delete from rti.program_sessions where organization_id in (?, ?)", organizationA, organizationB);
        admin.update("delete from rti.program_modules where organization_id in (?, ?)", organizationA, organizationB);
        admin.update("delete from rti.enrollments where organization_id in (?, ?)", organizationA, organizationB);
        admin.update("delete from rti.programs where organization_id in (?, ?)", organizationA, organizationB);
        admin.update("delete from rti.membership_roles where membership_id in (?, ?)", membershipA, membershipB);
        admin.update("delete from rti.organization_memberships where id in (?, ?)", membershipA, membershipB);
        admin.update("delete from rti.users where id in (?, ?)", userA, userB);
        admin.update("delete from rti.organizations where id in (?, ?)", organizationA, organizationB);
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
                  and c.relname in ('programs', 'enrollments', 'program_modules', 'program_sessions',
                                    'program_activities', 'activity_assignments',
                                    'program_participant_disc_profiles',
                                    'program_participant_disc_profile_revisions')
                  and c.relrowsecurity
                order by c.relname
        """, String.class)).containsExactly("activity_assignments", "enrollments", "program_activities",
                        "program_modules", "program_participant_disc_profile_revisions",
                        "program_participant_disc_profiles", "program_sessions", "programs");
        assertThat(admin.queryForList("""
                select policyname
                from pg_policies
                where schemaname = 'rti'
                  and tablename in ('programs', 'enrollments', 'program_modules', 'program_sessions',
                                    'program_activities', 'activity_assignments',
                                    'program_participant_disc_profiles',
                                    'program_participant_disc_profile_revisions')
                order by policyname
                """, String.class)).containsExactly("activity_assignments_tenant_isolation",
                        "enrollments_tenant_isolation", "program_activities_tenant_isolation",
                        "program_modules_tenant_isolation",
                        "program_participant_disc_profile_revisions_tenant_isolation",
                        "program_participant_disc_profiles_tenant_isolation", "program_sessions_tenant_isolation",
                        "programs_tenant_isolation");
    }

    @Test
    void noTenantContextRevealsNoTenantRows() {
        assertThat(count("programs")).isZero();
        assertThat(count("enrollments")).isZero();
        assertThat(count("program_modules")).isZero();
        assertThat(count("program_sessions")).isZero();
        assertThat(count("program_activities")).isZero();
        assertThat(count("activity_assignments")).isZero();
        assertThat(count("program_participant_disc_profiles")).isZero();
        assertThat(count("program_participant_disc_profile_revisions")).isZero();
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
            assertThat(countById("program_activities", activityA)).isEqualTo(1);
            assertThat(countById("program_activities", activityB)).isZero();
            assertThat(countById("activity_assignments", assignmentA)).isEqualTo(1);
            assertThat(countById("activity_assignments", assignmentB)).isZero();
            assertThat(countById("program_participant_disc_profiles", discProfileA)).isEqualTo(1);
            assertThat(countById("program_participant_disc_profiles", discProfileB)).isZero();
            assertThat(countById("program_participant_disc_profile_revisions", discRevisionA)).isEqualTo(1);
            assertThat(countById("program_participant_disc_profile_revisions", discRevisionB)).isZero();
        });

        assertThat(count("programs")).isZero();
        assertThat(count("enrollments")).isZero();
        assertThat(count("program_modules")).isZero();
        assertThat(count("program_sessions")).isZero();
        assertThat(count("program_activities")).isZero();
        assertThat(count("activity_assignments")).isZero();
        assertThat(count("program_participant_disc_profiles")).isZero();
        assertThat(count("program_participant_disc_profile_revisions")).isZero();
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
            assertThat(jdbcTemplate.update(
                    "update rti.program_activities set title = 'tampered' where id = ?", activityB)).isZero();
            assertThat(jdbcTemplate.update(
                    "update rti.activity_assignments set status = 'SUBMITTED', response_text = 'tampered', "
                            + "submitted_at = now() where id = ?", assignmentB)).isZero();
            assertThat(jdbcTemplate.update(
                    "update rti.program_participant_disc_profiles set dominant_text = 'tampered' where id = ?",
                    discProfileB)).isZero();
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
        assertThat(admin.queryForObject("select title from rti.program_activities where id = ?", String.class, activityB))
                .isEqualTo("Activity B");
        assertThat(admin.queryForObject("select count(*) from rti.activity_assignments where id = ?", Long.class, assignmentB))
                .isEqualTo(1);
        assertThat(admin.queryForObject("select status from rti.activity_assignments where id = ?", String.class, assignmentB))
                .isEqualTo("ASSIGNED");
        assertThat(admin.queryForObject("select dominant_text from rti.program_participant_disc_profiles where id = ?",
                String.class, discProfileB)).isEqualTo("D-B");
    }

    @Test
    void discAuditRevisionsAreAppendOnlyForTheRuntimeRole() {
        assertThatThrownBy(() -> transactions.executeWithoutResult(status -> {
            tenantContext.activate(organizationA);
            jdbcTemplate.update("update rti.program_participant_disc_profile_revisions "
                    + "set dominant_text = 'tampered' where id = ?", discRevisionA);
        })).isInstanceOf(DataAccessException.class);
    }

    @Test
    void tenantContextRejectsDiscAuditReferencesFromAnotherOrganization() {
        assertThatThrownBy(() -> transactions.executeWithoutResult(status -> {
            tenantContext.activate(organizationA);
            jdbcTemplate.update("""
                    insert into rti.program_participant_disc_profile_revisions
                        (id, profile_id, organization_id, program_id, enrollment_id, dominant_text,
                         influential_text, serene_text, conscientious_text, action, actor_id,
                         profile_version, recorded_at)
                    values (?, ?, ?, ?, ?, 'D', 'I', 'S', 'C', 'UPDATED', ?, 1, now())
                    """, uuid7(0xc17), discProfileB, organizationA, programA, enrollmentA, userA);
        })).isInstanceOf(DataAccessException.class);
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
