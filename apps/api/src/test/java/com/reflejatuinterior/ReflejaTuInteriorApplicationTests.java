package com.reflejatuinterior;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;

class ReflejaTuInteriorApplicationTests extends PostgreSqlIntegrationTestSupport {

    private static final List<String> MIGRATION_VERSIONS =
            List.of("202608240151", "202608240337", "20260909010000", "20260912010000", "20260913020000");

    private static final List<String> BUSINESS_TABLES = List.of(
            "enrollments",
            "membership_roles",
            "organization_memberships",
            "organizations",
            "program_modules",
            "program_sessions",
            "programs",
            "user_invitations",
            "users");

    @Autowired
    Environment environment;

    @Test
    void migratesAnEmptyPostgreSql18DatabaseAndValidatesTheJpaModel() {
        Integer databaseMajorVersion = jdbcTemplate.queryForObject(
                "select current_setting('server_version_num')::integer / 10000",
                Integer.class);
        String runtimeRole = jdbcTemplate.queryForObject("select current_user", String.class);
        List<String> successfulMigrations = migratorJdbcTemplate().queryForList(
                "select version from rti.flyway_schema_history "
                        + "where success and version is not null order by installed_rank",
                String.class);
        List<String> businessTables = jdbcTemplate.queryForList(
                "select table_name from information_schema.tables "
                        + "where table_schema = 'rti' and table_name <> 'flyway_schema_history' "
                        + "order by table_name",
                String.class);
        Integer uuidIdentifierCount = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.columns "
                        + "where table_schema = 'rti' and column_name = 'id' "
                        + "and data_type = 'uuid'",
                Integer.class);
        Integer symbolicStatusCount = jdbcTemplate.queryForObject(
                "select count(*) from information_schema.columns "
                        + "where table_schema = 'rti' and column_name in ('status', 'role') "
                        + "and data_type = 'character varying'",
                Integer.class);
        Boolean runtimeHasSchemaUsage = jdbcTemplate.queryForObject(
                "select has_schema_privilege(current_user, 'rti', 'USAGE')",
                Boolean.class);
        Boolean runtimeHasSchemaCreate = jdbcTemplate.queryForObject(
                "select has_schema_privilege(current_user, 'rti', 'CREATE')",
                Boolean.class);
        Integer migratorOwnedTableCount = jdbcTemplate.queryForObject(
                "select count(*) from pg_tables where schemaname = 'rti' "
                        + "and tablename in ('enrollments', 'membership_roles', "
                        + "'organization_memberships', 'organizations', 'program_modules', 'program_sessions', "
                        + "'programs', 'user_invitations', 'users') "
                        + "and tableowner = 'rti_migrator'",
                Integer.class);

        assertThat(databaseMajorVersion).isEqualTo(18);
        assertThat(runtimeRole).isEqualTo("rti_app");
        assertThat(successfulMigrations).containsExactlyElementsOf(MIGRATION_VERSIONS);
        assertThat(businessTables).containsExactlyElementsOf(BUSINESS_TABLES);
        assertThat(uuidIdentifierCount).isEqualTo(8);
        assertThat(symbolicStatusCount).isEqualTo(7);
        assertThat(runtimeHasSchemaUsage).isTrue();
        assertThat(runtimeHasSchemaCreate).isFalse();
        assertThat(migratorOwnedTableCount).isEqualTo(9);
        assertThat(environment.getProperty("spring.flyway.default-schema")).isEqualTo("rti");
        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(environment.getProperty("spring.jpa.open-in-view", Boolean.class)).isFalse();
    }
}
