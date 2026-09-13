package com.reflejatuinterior;

import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.postgresql.PostgreSQLContainer;

@SpringBootTest
public abstract class PostgreSqlIntegrationTestSupport {

    protected static final String TEST_COGNITO_ISSUER = "https://issuer.example.test";
    protected static final String TEST_COGNITO_CLIENT_ID = "test-client-id";

    private static final String RUNTIME_USERNAME = "rti_app";
    private static final String RUNTIME_PASSWORD = "rti_app_test";

    private static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:18")
                    .withDatabaseName("refleja_tu_interior_test")
                    .withUsername("rti_migrator")
                    .withPassword("rti_migrator_test")
                    .withInitScript("db/test/create-rti-app-role.sql");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void applicationProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", () -> RUNTIME_USERNAME);
        registry.add("spring.datasource.password", () -> RUNTIME_PASSWORD);
        registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
        registry.add("spring.flyway.user", POSTGRES::getUsername);
        registry.add("spring.flyway.password", POSTGRES::getPassword);
        registry.add("app.security.cognito.issuer-uri", () -> TEST_COGNITO_ISSUER);
        registry.add(
                "app.security.cognito.jwk-set-uri",
                () -> TEST_COGNITO_ISSUER + "/.well-known/jwks.json");
        registry.add("app.security.cognito.app-client-id", () -> TEST_COGNITO_CLIENT_ID);
    }

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    protected UUID uuid7(int suffix) {
        return UUID.fromString("01900000-0000-7000-8000-" + "%012x".formatted(suffix));
    }

    protected JdbcTemplate migratorJdbcTemplate() {
        return new JdbcTemplate(new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(),
                POSTGRES.getUsername(),
                POSTGRES.getPassword()));
    }

    protected void insertOrganization(UUID id) {
        jdbcTemplate.update(
                "insert into rti.organizations "
                        + "(id, name, status, default_time_zone, created_at, updated_at, version) "
                        + "values (?, ?, 'ACTIVE', 'America/Bogota', now(), now(), 0)",
                id,
                "Organization " + id);
    }

    protected void insertUser(UUID id) {
        jdbcTemplate.update(
                "insert into rti.users "
                        + "(id, cognito_subject, email, email_normalized, status, "
                        + "created_at, updated_at, version) "
                        + "values (?, ?, ?, ?, 'ACTIVE', now(), now(), 0)",
                id,
                "cognito-" + id,
                id + "@example.test",
                id + "@example.test");
    }

    protected void insertMembership(UUID id, UUID organizationId, UUID userId) {
        jdbcTemplate.update(
                "insert into rti.organization_memberships "
                        + "(id, organization_id, user_id, status, joined_at, "
                        + "created_at, updated_at, version) "
                        + "values (?, ?, ?, 'ACTIVE', now(), now(), now(), 0)",
                id,
                organizationId,
                userId);
    }

    protected void insertProgram(UUID id, UUID organizationId) {
        JdbcTemplate fixtureDatabase = jdbcTemplate;
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            jdbcTemplate.queryForObject(
                    "select set_config('app.current_organization_id', ?, true)",
                    String.class,
                    organizationId.toString());
        } else {
            fixtureDatabase = migratorJdbcTemplate();
        }
        fixtureDatabase.update(
                "insert into rti.programs "
                        + "(id, organization_id, name, status, created_at, updated_at, version) "
                        + "values (?, ?, ?, 'DRAFT', now(), now(), 0)",
                id,
                organizationId,
                "Program " + id);
    }
}
