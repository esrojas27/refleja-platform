package com.reflejatuinterior.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.time.Instant;
import java.util.UUID;
import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@AutoConfigureMockMvc
@Import(CognitoAuthenticationIntegrationTests.JwtTestConfiguration.class)
@Transactional
class ProgramTemplateIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID organization = uuid7(0x1701), user = uuid7(0x1702), membership = uuid7(0x1703);
    private final UUID destinationOrganization = uuid7(0x1711), destinationMembership = uuid7(0x1712);
    private final UUID sourceProgram = uuid7(0x1704), emptyProgram = uuid7(0x1705);
    private final UUID dimension = uuid7(0x1706), session = uuid7(0x1707), activity = uuid7(0x1708);
    private final UUID evaluation = uuid7(0x1709), question = uuid7(0x170a);
    @Autowired MockMvc mvc;
    @Autowired JwtEncoder encoder;
    @Autowired ObjectMapper json;
    @Autowired OrganizationTenantContext tenantContext;
    private String bearer;

    @BeforeEach
    void setup() {
        insertOrganization(organization);
        insertOrganization(destinationOrganization);
        insertUser(user);
        insertMembership(membership, organization, user);
        insertMembership(destinationMembership, destinationOrganization, user);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'CONSULTANT')", membership);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'CONSULTANT')", destinationMembership);
        insertProgram(sourceProgram, organization);
        insertProgram(emptyProgram, organization);
        tenantContext.activate(organization);
        jdbcTemplate.update("update rti.programs set name='Programa fuente', description='Contenido validado', "
                + "start_date='2026-10-01', end_date='2026-10-31' where id=?", sourceProgram);
        jdbcTemplate.update("update rti.programs set start_date='2026-11-01', end_date='2026-11-30' where id=?",
                emptyProgram);
        jdbcTemplate.update("""
                insert into rti.program_modules
                    (id, organization_id, program_id, name, description, position, created_at, updated_at, version)
                values (?, ?, ?, 'Interior', 'Primera dimensión', 1, now(), now(), 0)
                """, dimension, organization, sourceProgram);
        jdbcTemplate.update("""
                insert into rti.program_sessions
                    (id, organization_id, program_id, module_id, name, description, objective,
                     scheduled_date, position, created_at, updated_at, version)
                values (?, ?, ?, ?, 'Sesión uno', 'Descripción', 'Objetivo', '2026-10-05', 1, now(), now(), 0)
                """, session, organization, sourceProgram, dimension);
        jdbcTemplate.update("""
                insert into rti.program_activities
                    (id, organization_id, program_id, module_id, session_id, title, instructions,
                     youtube_url, due_date, position, created_at, updated_at, version)
                values (?, ?, ?, ?, ?, 'Actividad uno', 'Reflexiona.', 'https://youtu.be/dQw4w9WgXcQ',
                        '2026-10-08', 1, now(), now(), 0)
                """, activity, organization, sourceProgram, dimension, session);
        jdbcTemplate.update("""
                insert into rti.activity_evaluations
                    (id, organization_id, program_id, activity_id, title, instructions,
                     created_at, updated_at, version)
                values (?, ?, ?, ?, 'Encuesta uno', 'Comparte tu experiencia.', now(), now(), 0)
                """, evaluation, organization, sourceProgram, activity);
        jdbcTemplate.update("""
                insert into rti.activity_evaluation_questions
                    (id, organization_id, program_id, evaluation_id, prompt, question_type,
                     position, created_at, updated_at, version)
                values (?, ?, ?, ?, '¿Qué tan de acuerdo estás?', 'AGREEMENT_SCALE', 1, now(), now(), 0)
                """, question, organization, sourceProgram, evaluation);
        bearer = token();
    }

    @Test
    void createsAnImmutableTemplateAndMaterializesTheCompleteContentWithoutParticipants() throws Exception {
        mvc.perform(get(programPath(sourceProgram) + "/template-readiness").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.eligible").value(true))
                .andExpect(jsonPath("$.dimensionCount").value(1)).andExpect(jsonPath("$.sessionCount").value(1))
                .andExpect(jsonPath("$.activityCount").value(1)).andExpect(jsonPath("$.surveyCount").value(1));

        var templateResponse = mvc.perform(post(templatePath()).header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"sourceProgramId":"%s","name":"Plantilla liderazgo","description":"Lista para reutilizar"}
                                """.formatted(sourceProgram)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("Plantilla liderazgo"))
                .andExpect(jsonPath("$.sourceOrganizationId").value(organization.toString()))
                .andExpect(jsonPath("$.activityCount").value(1)).andReturn().getResponse();
        var templateId = UUID.fromString(json.readTree(templateResponse.getContentAsString()).path("id").asText());
        assertThat(templateId.version()).isEqualTo(7);

        mvc.perform(get(templatePath(destinationOrganization)).header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(templateId.toString()));

        var programResponse = mvc.perform(post(templatePath(destinationOrganization) + "/" + templateId + "/programs")
                        .header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content("""
                                {"name":"Programa clonado","description":"Nueva cohorte", "startDate":"2027-02-01","endDate":"2027-03-03"}
                                """))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.name").value("Programa clonado"))
                .andExpect(jsonPath("$.organizationId").value(destinationOrganization.toString()))
                .andReturn().getResponse();
        var clonedProgram = UUID.fromString(json.readTree(programResponse.getContentAsString()).path("id").asText());

        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.program_modules where program_id=?", Long.class,
                clonedProgram)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.program_sessions where program_id=?", Long.class,
                clonedProgram)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.program_activities where program_id=?", Long.class,
                clonedProgram)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.activity_evaluations where program_id=?", Long.class,
                clonedProgram)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select scheduled_date from rti.program_sessions where program_id=?",
                java.time.LocalDate.class, clonedProgram)).isEqualTo(java.time.LocalDate.parse("2027-02-05"));
        assertThat(jdbcTemplate.queryForObject("select due_date from rti.program_activities where program_id=?",
                java.time.LocalDate.class, clonedProgram)).isEqualTo(java.time.LocalDate.parse("2027-02-08"));
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.enrollments where program_id=?", Long.class,
                clonedProgram)).isZero();
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.activity_assignments where program_id=?", Long.class,
                clonedProgram)).isZero();
    }

    @Test
    void requiresEveryLevelAndSurveyBeforeEnablingTemplateCreation() throws Exception {
        mvc.perform(get(programPath(emptyProgram) + "/template-readiness").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.eligible").value(false))
                .andExpect(jsonPath("$.issues[0]").value("MISSING_DIMENSIONS"));
        mvc.perform(post(templatePath()).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sourceProgramId":"%s","name":"Incompleta","description":"No debe persistir"}
                                """.formatted(emptyProgram)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_TEMPLATE_INCOMPLETE"));
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.program_templates", Long.class)).isZero();
    }

    @Test
    void rejectsReadOnlyOrganizationRoles() throws Exception {
        jdbcTemplate.update("delete from rti.membership_roles where membership_id=?", membership);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'COMPANY_ADMIN')", membership);
        mvc.perform(get(templatePath()).header("Authorization", bearer)).andExpect(status().isForbidden());
        mvc.perform(get(programPath(sourceProgram) + "/template-readiness").header("Authorization", bearer))
                .andExpect(status().isForbidden());
    }

    private String templatePath() { return templatePath(organization); }
    private String templatePath(UUID organizationId) {
        return "/api/v1/organizations/" + organizationId + "/program-templates";
    }
    private String programPath(UUID programId) {
        return "/api/v1/organizations/" + organization + "/programs/" + programId;
    }
    private String token() {
        var now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(TEST_COGNITO_ISSUER).subject("cognito-" + user)
                .issuedAt(now).expiresAt(now.plusSeconds(300)).claim("token_use", "access")
                .claim("client_id", TEST_COGNITO_CLIENT_ID).build();
        return "Bearer " + encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(SignatureAlgorithm.RS256).build(), claims)).getTokenValue();
    }
}
