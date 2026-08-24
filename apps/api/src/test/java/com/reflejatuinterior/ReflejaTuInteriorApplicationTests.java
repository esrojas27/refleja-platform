package com.reflejatuinterior;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Testcontainers
@SpringBootTest
class ReflejaTuInteriorApplicationTests {

    private static final String MIGRATION_VERSION = "202608240151";

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18")
            .withDatabaseName("refleja_tu_interior_test")
            .withUsername("rti_test")
            .withPassword("rti_test");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
        registry.add("spring.flyway.user", POSTGRES::getUsername);
        registry.add("spring.flyway.password", POSTGRES::getPassword);
    }

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Autowired
    Environment environment;

    @Test
    void startsWithPostgreSql18FlywayAndHibernateValidation() {
        Integer databaseMajorVersion = jdbcTemplate.queryForObject(
                "select current_setting('server_version_num')::integer / 10000",
                Integer.class);
        Boolean schemaExists = jdbcTemplate.queryForObject(
                "select exists (select 1 from information_schema.schemata where schema_name = 'rti')",
                Boolean.class);
        Integer successfulMigrationCount = jdbcTemplate.queryForObject(
                "select count(*) from rti.flyway_schema_history where version = ? and success",
                Integer.class,
                MIGRATION_VERSION);
        List<String> applicationTables = jdbcTemplate.queryForList(
                "select table_name from information_schema.tables "
                        + "where table_schema = 'rti' order by table_name",
                String.class);

        assertThat(databaseMajorVersion).isEqualTo(18);
        assertThat(schemaExists).isTrue();
        assertThat(successfulMigrationCount).isEqualTo(1);
        assertThat(applicationTables).containsExactly("flyway_schema_history");
        assertThat(environment.getProperty("spring.flyway.default-schema")).isEqualTo("rti");
        assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
        assertThat(environment.getProperty("spring.jpa.open-in-view", Boolean.class)).isFalse();
    }
}
