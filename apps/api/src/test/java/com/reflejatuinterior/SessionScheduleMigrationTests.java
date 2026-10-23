package com.reflejatuinterior;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.LocalDate;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Upgrade rehearsal against a separate disposable database, never the local/DEV database. */
class SessionScheduleMigrationTests {
    @Test void preservesExistingDatesDeliveriesAndProgressWithoutSendingNotifications() {
        try(var postgres=new PostgreSQLContainer("postgres:18").withDatabaseName("refleja_tu_interior_test")
                .withUsername("rti_migrator").withPassword("disposable-test-only").withInitScript("db/test/create-rti-app-role.sql")) {
            postgres.start();
            var database=new DriverManagerDataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword());
            Flyway.configure().dataSource(database).defaultSchema("rti").schemas("rti").locations("classpath:db/migration")
                    .target("20261022020000").load().migrate();
            var jdbc=new JdbcTemplate(database);
            var org=jdbc.queryForObject("INSERT INTO rti.organizations(id,name,status,default_time_zone,created_at,updated_at,version) VALUES(uuidv7(),'Upgrade fixture','ACTIVE','America/Bogota',now(),now(),0) RETURNING id",UUID.class);
            var user=jdbc.queryForObject("INSERT INTO rti.users(id,cognito_subject,email,email_normalized,status,created_at,updated_at,version) VALUES(uuidv7(),'upgrade-fixture','upgrade@example.test','upgrade@example.test','ACTIVE',now(),now(),0) RETURNING id",UUID.class);
            var member=jdbc.queryForObject("INSERT INTO rti.organization_memberships(id,organization_id,user_id,status,joined_at,created_at,updated_at,version) VALUES(uuidv7(),?,?,'ACTIVE',now(),now(),now(),0) RETURNING id",UUID.class,org,user);
            var program=jdbc.queryForObject("INSERT INTO rti.programs(id,organization_id,name,status,start_date,end_date,created_at,updated_at,version) VALUES(uuidv7(),?,'Programa existente','ACTIVE','2026-01-01','2026-12-31',now(),now(),4) RETURNING id",UUID.class,org);
            var dimension=jdbc.queryForObject("INSERT INTO rti.program_modules(id,organization_id,program_id,name,position,created_at,updated_at,version) VALUES(uuidv7(),?,?,'Dimensión',1,now(),now(),0) RETURNING id",UUID.class,org,program);
            var session=jdbc.queryForObject("INSERT INTO rti.program_sessions(id,organization_id,program_id,module_id,name,scheduled_date,position,created_at,updated_at,version) VALUES(uuidv7(),?,?,?,'Sesión','2026-10-01',1,now(),now(),3) RETURNING id",UUID.class,org,program,dimension);
            var enrollment=jdbc.queryForObject("INSERT INTO rti.enrollments(id,organization_id,program_id,participant_membership_id,status,created_at,updated_at,version) VALUES(uuidv7(),?,?,?,'ACTIVE',now(),now(),2) RETURNING id",UUID.class,org,program,member);
            var activity=jdbc.queryForObject("INSERT INTO rti.program_activities(id,organization_id,program_id,module_id,session_id,title,instructions,due_date,position,created_at,updated_at,version) VALUES(uuidv7(),?,?,?,?,'Actividad','Instrucciones','2026-10-10',1,now(),now(),5) RETURNING id",UUID.class,org,program,dimension,session);
            var assignment=jdbc.queryForObject("INSERT INTO rti.activity_assignments(id,organization_id,program_id,activity_id,enrollment_id,assigned_at,status,response_text,submitted_at,created_at,updated_at,version) VALUES(uuidv7(),?,?,?, ?,now(),'SUBMITTED','Mi entrega existente',now(),now(),now(),7) RETURNING id",UUID.class,org,program,activity,enrollment);

            Flyway.configure().dataSource(database).defaultSchema("rti").schemas("rti").locations("classpath:db/migration").load().migrate();
            assertThat(jdbc.queryForObject("SELECT scheduled_date FROM rti.session_schedules WHERE enrollment_id=? AND session_id=?",LocalDate.class,enrollment,session)).isEqualTo(LocalDate.parse("2026-10-01"));
            assertThat(jdbc.queryForObject("SELECT due_date FROM rti.activity_assignments WHERE id=?",LocalDate.class,assignment)).isEqualTo(LocalDate.parse("2026-10-10"));
            assertThat(jdbc.queryForObject("SELECT response_text FROM rti.activity_assignments WHERE id=?",String.class,assignment)).isEqualTo("Mi entrega existente");
            assertThat(jdbc.queryForObject("SELECT status FROM rti.activity_assignments WHERE id=?",String.class,assignment)).isEqualTo("SUBMITTED");
            assertThat(jdbc.queryForObject("SELECT version FROM rti.activity_assignments WHERE id=?",Long.class,assignment)).isEqualTo(7);
            assertThat(jdbc.queryForObject("SELECT version FROM rti.enrollments WHERE id=?",Long.class,enrollment)).isEqualTo(2);
            assertThat(jdbc.queryForObject("SELECT source FROM rti.session_schedule_history WHERE enrollment_id=?",String.class,enrollment)).isEqualTo("MIGRATED");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM rti.session_schedule_notifications",Long.class)).isZero();
        }
    }
}
