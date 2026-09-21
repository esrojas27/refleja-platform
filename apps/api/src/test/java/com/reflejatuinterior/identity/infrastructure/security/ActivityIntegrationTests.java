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
class ActivityIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID organization = uuid7(0xd01), consultant = uuid7(0xd02), consultantMembership = uuid7(0xd03);
    private final UUID collaborator = uuid7(0xd04), collaboratorMembership = uuid7(0xd05), enrollment = uuid7(0xd06);
    private final UUID otherCollaborator = uuid7(0xd07), otherMembership = uuid7(0xd08), otherEnrollment = uuid7(0xd09);
    private final UUID program = uuid7(0xd0a), module = uuid7(0xd0b), session = uuid7(0xd0c);
    @Autowired MockMvc mvc;
    @Autowired JwtEncoder encoder;
    @Autowired ObjectMapper json;
    @Autowired OrganizationTenantContext tenantContext;

    @BeforeEach void setup() {
        insertOrganization(organization);
        insertUser(consultant); insertUser(collaborator); insertUser(otherCollaborator);
        insertMembership(consultantMembership, organization, consultant);
        insertMembership(collaboratorMembership, organization, collaborator);
        insertMembership(otherMembership, organization, otherCollaborator);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'CONSULTANT')", consultantMembership);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'COLLABORATOR')", collaboratorMembership);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'COLLABORATOR')", otherMembership);
        insertProgram(program, organization);
        tenantContext.activate(organization);
        jdbcTemplate.update("""
                insert into rti.program_modules
                    (id, organization_id, program_id, name, position, created_at, updated_at, version)
                values (?, ?, ?, 'Fundamentos', 1, now(), now(), 0)
                """, module, organization, program);
        jdbcTemplate.update("""
                insert into rti.program_sessions
                    (id, organization_id, program_id, module_id, name, scheduled_date, position,
                     created_at, updated_at, version)
                values (?, ?, ?, ?, 'Sesión inicial', '2026-10-01', 1, now(), now(), 0)
                """, session, organization, program, module);
        jdbcTemplate.update("""
                insert into rti.enrollments
                    (id, organization_id, program_id, participant_membership_id, status,
                     created_at, updated_at, version)
                values (?, ?, ?, ?, 'ACTIVE', now(), now(), 0),
                       (?, ?, ?, ?, 'ACTIVE', now(), now(), 0)
                """, enrollment, organization, program, collaboratorMembership,
                otherEnrollment, organization, program, otherMembership);
    }

    @Test void consultantCreatesAndAssignsWhileOnlyTheSelectedCollaboratorCanView() throws Exception {
        var createdResponse = mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(body(enrollment)))
                .andExpect(status().isCreated()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.title").value("Reflexión inicial"))
                .andExpect(jsonPath("$.instructions").value("Describe tu punto de partida."))
                .andExpect(jsonPath("$.youtubeUrl").value("https://youtu.be/dQw4w9WgXcQ"))
                .andExpect(jsonPath("$.sessionId").value(session.toString()))
                .andExpect(jsonPath("$.dimensionName").value("Fundamentos"))
                .andExpect(jsonPath("$.sessionName").value("Sesión inicial"))
                .andExpect(jsonPath("$.assignees[0].enrollmentId").value(enrollment.toString()))
                .andReturn().getResponse();
        var activityId = UUID.fromString(json.readTree(createdResponse.getContentAsString()).path("id").asText());
        assertThat(activityId.version()).isEqualTo(7);

        mvc.perform(get(consultantPath()).header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(activityId.toString()));
        mvc.perform(get(collaboratorPath()).header("Authorization", token(collaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(activityId.toString()))
                .andExpect(jsonPath("$.items[0].dimensionName").value("Fundamentos"))
                .andExpect(jsonPath("$.items[0].sessionName").value("Sesión inicial"))
                .andExpect(jsonPath("$.items[0].youtubeUrl").value("https://youtu.be/dQw4w9WgXcQ"))
                .andExpect(jsonPath("$.items[0].assignees").doesNotExist());
        mvc.perform(get(collaboratorPath()).header("Authorization", token(otherCollaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());

        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.program_activities where id=?", Long.class, activityId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.activity_assignments where activity_id=?", Long.class, activityId)).isEqualTo(1);
    }

    @Test void creationIsAtomicAndRequiresAConsultantActiveEnrollmentAndValidInput() throws Exception {
        jdbcTemplate.update("update rti.enrollments set status='INVITED' where id=?", enrollment);
        mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(body(enrollment)))
                .andExpect(status().isNotFound());
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.program_activities", Long.class)).isZero();

        mvc.perform(post(consultantPath()).header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content(body(otherEnrollment)))
                .andExpect(status().isForbidden());
        mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sessionId\":\"" + session + "\",\"title\":\" \",\"instructions\":\"\","
                        + "\"dueDate\":\"2026-10-08\",\"position\":0,\"enrollmentIds\":[]}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(body(otherEnrollment, otherEnrollment)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("enrollmentIds"));
        mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(otherEnrollment).replace("https://youtu.be/dQw4w9WgXcQ", "https://example.com/video")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("youtubeUrl"));
    }

    @Test void consultantAssignsEveryoneAndReviewsCollaboratorSubmissions() throws Exception {
        var created = mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(allBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.assignees.length()").value(2))
                .andExpect(jsonPath("$.assignees[0].status").value("ASSIGNED"))
                .andReturn().getResponse();
        var tree = json.readTree(created.getContentAsString());
        var activityId = UUID.fromString(tree.path("id").asText());
        var assignmentId = UUID.fromString(tree.path("assignees").get(0).path("assignmentId").asText());
        var firstEnrollmentId = UUID.fromString(tree.path("assignees").get(0).path("enrollmentId").asText());
        var firstCollaborator = firstEnrollmentId.equals(enrollment) ? collaborator : otherCollaborator;

        mvc.perform(post(collaboratorPath() + "/" + activityId + "/submission")
                .header("Authorization", token(firstCollaborator)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"responseText\":\"  Mi reflexión final.  \"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assignmentStatus").value("SUBMITTED"))
                .andExpect(jsonPath("$.responseText").value("Mi reflexión final."));

        mvc.perform(post(collaboratorPath() + "/" + activityId + "/submission")
                .header("Authorization", token(firstCollaborator)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"responseText\":\"Duplicada\"}"))
                .andExpect(status().isConflict());

        mvc.perform(post(reviewPath(activityId, assignmentId)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"REQUEST_CHANGES\",\"comment\":\"  Agrega un ejemplo.  \"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CHANGES_REQUESTED"))
                .andExpect(jsonPath("$.reviewComment").value("Agrega un ejemplo."));

        mvc.perform(post(collaboratorPath() + "/" + activityId + "/submission")
                .header("Authorization", token(firstCollaborator)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"responseText\":\"Reflexión con ejemplo.\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assignmentStatus").value("SUBMITTED"))
                .andExpect(jsonPath("$.reviewComment").doesNotExist());

        mvc.perform(post(reviewPath(activityId, assignmentId)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"APPROVE\",\"comment\":\"Buen trabajo.\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));

        mvc.perform(get(collaboratorPath()).header("Authorization", token(firstCollaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].assignmentStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.items[0].responseText").value("Reflexión con ejemplo."));
    }

    @Test void consultantCreatesProgramContentBeforeAnyParticipantIsActive() throws Exception {
        jdbcTemplate.update("update rti.enrollments set status='INVITED' where program_id=?", program);

        var created = mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(allBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Reflexión general"))
                .andExpect(jsonPath("$.assignees").isEmpty())
                .andReturn().getResponse();
        var activityId = UUID.fromString(json.readTree(created.getContentAsString()).path("id").asText());

        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from rti.program_activities where id=?", Long.class, activityId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from rti.activity_assignments where activity_id=?", Long.class, activityId)).isZero();
    }

    @Test void requiresAuthenticationAndDoesNotExposeUnknownSessions() throws Exception {
        mvc.perform(get(consultantPath())).andExpect(status().isUnauthorized());
        mvc.perform(get(collaboratorPath())).andExpect(status().isUnauthorized());
        mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(otherEnrollment).replace(session.toString(), uuid7(0xdff).toString())))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("PROGRAM_NOT_FOUND"));
    }

    private String consultantPath() {
        return "/api/v1/organizations/" + organization + "/programs/" + program + "/activities";
    }
    private String collaboratorPath() { return "/api/v1/me/programs/" + program + "/activities"; }
    private String reviewPath(UUID activityId, UUID assignmentId) {
        return consultantPath() + "/" + activityId + "/assignments/" + assignmentId + "/review";
    }
    private String body(UUID... enrollmentIds) {
        var ids = java.util.Arrays.stream(enrollmentIds).map(id -> "\"" + id + "\"")
                .collect(java.util.stream.Collectors.joining(","));
        return "{\"sessionId\":\"" + session + "\",\"title\":\" Reflexión inicial \","
                + "\"instructions\":\"Describe tu punto de partida.\","
                + "\"youtubeUrl\":\"https://youtu.be/dQw4w9WgXcQ\",\"dueDate\":\"2026-10-08\","
                + "\"position\":1,\"assignToAll\":false,\"enrollmentIds\":[" + ids + "]}";
    }
    private String allBody() {
        return "{\"sessionId\":\"" + session + "\",\"title\":\"Reflexión general\","
                + "\"instructions\":\"Describe tu avance.\",\"youtubeUrl\":null,\"dueDate\":\"2026-10-08\","
                + "\"position\":1,\"assignToAll\":true,\"enrollmentIds\":[]}";
    }
    private String token(UUID userId) {
        var now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(TEST_COGNITO_ISSUER).subject("cognito-" + userId)
                .issuedAt(now).expiresAt(now.plusSeconds(300)).claim("token_use", "access")
                .claim("client_id", TEST_COGNITO_CLIENT_ID).build();
        return "Bearer " + encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(SignatureAlgorithm.RS256).build(), claims)).getTokenValue();
    }
}
