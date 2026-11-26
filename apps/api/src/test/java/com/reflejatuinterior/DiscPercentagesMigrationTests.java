package com.reflejatuinterior;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.postgresql.PostgreSQLContainer;

class DiscPercentagesMigrationTests {
    @Test void preservesExistingQualitativeProfilesRevisionsAndFilesDuringUpgrade() {
        try(var postgres=new PostgreSQLContainer("postgres:18").withDatabaseName("refleja_tu_interior_test")
                .withUsername("rti_migrator").withPassword("disposable-test-only").withInitScript("db/test/create-rti-app-role.sql")){
            postgres.start();
            var source=new DriverManagerDataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword());
            Flyway.configure().dataSource(source).defaultSchema("rti").schemas("rti").locations("classpath:db/migration").target("20261125020000").load().migrate();
            var jdbc=new JdbcTemplate(source);
            var org=jdbc.queryForObject("insert into rti.organizations(id,name,status,default_time_zone,created_at,updated_at,version) values(uuidv7(),'Existing company','ACTIVE','America/Bogota',now(),now(),0) returning id",UUID.class);
            var user=jdbc.queryForObject("insert into rti.users(id,cognito_subject,email,email_normalized,status,created_at,updated_at,version) values(uuidv7(),'disc-upgrade','upgrade@example.test','upgrade@example.test','ACTIVE',now(),now(),0) returning id",UUID.class);
            var member=jdbc.queryForObject("insert into rti.organization_memberships(id,organization_id,user_id,status,profile_status,joined_at,created_at,updated_at,version) values(uuidv7(),?,?,'ACTIVE','COMPLETE',now(),now(),now(),0) returning id",UUID.class,org,user);
            var program=jdbc.queryForObject("insert into rti.programs(id,organization_id,name,status,created_at,updated_at,version) values(uuidv7(),?,'Existing program','ACTIVE',now(),now(),4) returning id",UUID.class,org);
            var enrollment=jdbc.queryForObject("insert into rti.enrollments(id,organization_id,program_id,participant_membership_id,status,created_at,updated_at,version) values(uuidv7(),?,?,?,'ACTIVE',now(),now(),2) returning id",UUID.class,org,program,member);
            var profile=jdbc.queryForObject("""
                insert into rti.program_participant_disc_profiles(id,organization_id,program_id,enrollment_id,dominant_text,influential_text,serene_text,conscientious_text,created_by,updated_by,created_at,updated_at,version)
                values(uuidv7(),?,?,?,'Existing D','Existing I','Existing S','Existing C',?,?,now(),now(),3) returning id
                """,UUID.class,org,program,enrollment,user,user);
            jdbc.update("""
                insert into rti.program_participant_disc_profile_revisions(id,profile_id,organization_id,program_id,enrollment_id,dominant_text,influential_text,serene_text,conscientious_text,action,actor_id,profile_version,recorded_at)
                values(uuidv7(),?,?,?,?,'Existing D','Existing I','Existing S','Existing C','CREATED',?,3,now())
                """,profile,org,program,enrollment,user);
            var original=new byte[]{1,2,3,4};
            var file=jdbc.queryForObject("insert into rti.participant_files(id,organization_id,program_id,enrollment_id,slot,title,content_type,file_bytes,created_by) values(uuidv7(),?,?,?,1,'Existing document','application/pdf',?,?) returning id",UUID.class,org,program,enrollment,original,user);
            Flyway.configure().dataSource(source).defaultSchema("rti").schemas("rti").locations("classpath:db/migration").load().migrate();
            assertThat(jdbc.queryForObject("select dominant_text from rti.program_participant_disc_profiles where id=?",String.class,profile)).isEqualTo("Existing D");
            assertThat(jdbc.queryForObject("select dominant_percent from rti.program_participant_disc_profiles where id=?",Integer.class,profile)).isNull();
            assertThat(jdbc.queryForObject("select profile_version from rti.program_participant_disc_profile_revisions where profile_id=?",Long.class,profile)).isEqualTo(3);
            assertThat(jdbc.queryForObject("select version from rti.enrollments where id=?",Long.class,enrollment)).isEqualTo(2);
            assertThat(jdbc.queryForObject("select disc_pdf_version from rti.enrollments where id=?",Integer.class,enrollment)).isZero();
            assertThat(jdbc.queryForObject("select file_bytes from rti.participant_files where id=?",byte[].class,file)).isEqualTo(original);
            assertThat(jdbc.queryForObject("select document_type from rti.participant_files where id=?",String.class,file)).isNull();
            assertThat(jdbc.queryForObject("select has_table_privilege('rti_app','rti.participant_files','UPDATE')",Boolean.class)).isFalse();
        }
    }
}
