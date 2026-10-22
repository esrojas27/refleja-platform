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
    @Autowired com.reflejatuinterior.participation.application.Notifications notifications;

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
        jdbcTemplate.update("update rti.programs set status='ACTIVE' where id=? and organization_id=?", program, organization);
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

    @Test void consultantCreatesAndListsAnEvaluationWithEverySupportedQuestionType() throws Exception {
        var activityResponse = mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(allBody()))
                .andExpect(status().isCreated()).andReturn().getResponse();
        var activityTree = json.readTree(activityResponse.getContentAsString());
        var activityId = UUID.fromString(activityTree.path("id").asText());
        var collaboratorAssignment = java.util.stream.StreamSupport.stream(
                activityTree.path("assignees").spliterator(), false)
                .filter(item -> item.path("enrollmentId").asText().equals(enrollment.toString()))
                .findFirst().orElseThrow();
        var assignmentId = UUID.fromString(collaboratorAssignment.path("assignmentId").asText());
        var evaluationBody = """
                {"title":"Encuesta de cierre","instructions":"Responde desde tu experiencia.","questions":[
                  {"prompt":"¿Qué tan de acuerdo estás?","type":"AGREEMENT_SCALE","position":1},
                  {"prompt":"¿Qué tan probable es que lo apliques?","type":"LIKELIHOOD_SCALE","position":2},
                  {"prompt":"¿Qué te llevas de la actividad?","type":"OPEN_TEXT","position":3},
                  {"prompt":"¿Cómo te sentiste?","type":"EMOTION_MULTI_SELECT","position":4}
                ]}
                """;

        var evaluationResponse = mvc.perform(post(evaluationPath(activityId)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(evaluationBody))
                .andExpect(status().isCreated()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.activityId").value(activityId.toString()))
                .andExpect(jsonPath("$.questions.length()").value(4))
                .andExpect(jsonPath("$.questions[0].type").value("AGREEMENT_SCALE"))
                .andExpect(jsonPath("$.questions[3].type").value("EMOTION_MULTI_SELECT"))
                .andReturn().getResponse();
        var evaluationTree = json.readTree(evaluationResponse.getContentAsString());

        mvc.perform(get(evaluationsPath()).header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Encuesta de cierre"));
        mvc.perform(get(evaluationsPath()).header("Authorization", token(collaborator)))
                .andExpect(status().isForbidden());
        mvc.perform(post(surveyResponsePath(activityId)).header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content(surveyResponseBody(evaluationTree)))
                .andExpect(status().isConflict());

        mvc.perform(post(collaboratorPath() + "/" + activityId + "/submission")
                .header("Authorization", token(collaborator)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"responseText\":\"Mi reflexión para la encuesta.\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assignmentStatus").value("SUBMITTED"))
                .andExpect(jsonPath("$.survey.status").value("PENDING"))
                .andExpect(jsonPath("$.completionPercentage").value(50));

        mvc.perform(post(reviewPath(activityId, assignmentId)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"APPROVE\",\"comment\":\"Buen trabajo.\"}"))
                .andExpect(status().isConflict());

        mvc.perform(post(surveyResponsePath(activityId)).header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content(surveyResponseBody(evaluationTree)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
        mvc.perform(post(surveyResponsePath(activityId)).header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content(surveyResponseBody(evaluationTree)))
                .andExpect(status().isConflict());

        mvc.perform(get(collaboratorPath()).header("Authorization", token(collaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].survey.status").value("COMPLETED"))
                .andExpect(jsonPath("$.items[0].completionPercentage").value(100));
        mvc.perform(post(reviewPath(activityId, assignmentId)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decision\":\"APPROVE\",\"comment\":\"Buen trabajo.\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
        mvc.perform(post(evaluationPath(activityId)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(evaluationBody))
                .andExpect(status().isConflict());
    }

    @Test void draftHidesAssignedContentAndRefusesCollaboratorWrites() throws Exception {
        jdbcTemplate.update("update rti.programs set status='DRAFT' where id=? and organization_id=?", program, organization);
        var created = mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(body(enrollment))).andExpect(status().isCreated())
                .andReturn().getResponse();
        var id = UUID.fromString(json.readTree(created.getContentAsString()).path("id").asText());
        mvc.perform(get(collaboratorPath()).header("Authorization", token(collaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(post(collaboratorPath() + "/" + id + "/submission").header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"responseText\":\"No debe guardarse\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_NOT_ACTIVE"));
        mvc.perform(post(surveyResponsePath(id)).header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"answers\":[{\"questionId\":\"" + uuid7(0xdff) + "\",\"values\":[\"Respuesta\"]}]}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_NOT_ACTIVE"));
        mvc.perform(post("/api/v1/organizations/" + organization + "/programs/" + program + "/status")
                .header("Authorization", token(consultant)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CANCELLED\",\"version\":0}"))
                .andExpect(status().isOk());
        mvc.perform(get(collaboratorPath()).header("Authorization", token(collaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"COMPLETED", "CANCELLED"})
    void closedProgramsPreservePendingWorkAndRefuseAllProgramMutations(String terminal) throws Exception {
        var created = mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(body(enrollment))).andExpect(status().isCreated())
                .andReturn().getResponse();
        var tree = json.readTree(created.getContentAsString());
        var id = UUID.fromString(tree.path("id").asText());
        var assignmentId = UUID.fromString(tree.path("assignees").get(0).path("assignmentId").asText());
        String survey = "{\"title\":\"Encuesta\",\"instructions\":\"Responde\",\"questions\":["
                + "{\"prompt\":\"¿Qué aprendiste?\",\"type\":\"OPEN_TEXT\",\"position\":1}]}";
        mvc.perform(post(evaluationPath(id)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(survey)).andExpect(status().isCreated());
        mvc.perform(post(collaboratorPath() + "/" + id + "/submission").header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"responseText\":\"Entrega conservada\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.completionPercentage").value(50));

        var base = "/api/v1/organizations/" + organization + "/programs/" + program;
        mvc.perform(post(base + "/status").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + terminal + "\",\"version\":0}"))
                .andExpect(status().isOk());

        mvc.perform(get(collaboratorPath()).header("Authorization", token(collaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].responseText").value("Entrega conservada"))
                .andExpect(jsonPath("$.items[0].survey.status").value("PENDING"))
                .andExpect(jsonPath("$.items[0].completionPercentage").value(50));
        mvc.perform(post(collaboratorPath() + "/" + id + "/submission").header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"responseText\":\"No guardar\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_NOT_ACTIVE"));
        mvc.perform(post(surveyResponsePath(id)).header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"answers\":[{\"questionId\":\"" + uuid7(0xdff) + "\",\"values\":[\"Respuesta\"]}]}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_NOT_ACTIVE"));
        mvc.perform(post(reviewPath(id, assignmentId)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVE\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_NOT_ACTIVE"));
        mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(allBody()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_READ_ONLY"));
        mvc.perform(post(evaluationPath(id)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(survey))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_READ_ONLY"));
        mvc.perform(post(base + "/modules").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Otra dimensión\",\"position\":2}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_READ_ONLY"));
        mvc.perform(post(base + "/modules/" + module + "/sessions").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Otra sesión\",\"scheduledDate\":\"2026-10-01\",\"position\":2}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_READ_ONLY"));
        mvc.perform(put(base + "/disc-profiles/" + enrollment).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"dominant\":\"D\",\"influential\":\"I\",\"serene\":\"S\",\"conscientious\":\"C\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_READ_ONLY"));
    }

    @Test void requiresAuthenticationAndDoesNotExposeUnknownSessions() throws Exception {
        mvc.perform(get(consultantPath())).andExpect(status().isUnauthorized());
        mvc.perform(get(collaboratorPath())).andExpect(status().isUnauthorized());
        mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(otherEnrollment).replace(session.toString(), uuid7(0xdff).toString())))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("PROGRAM_NOT_FOUND"));
    }

    @Test void editsContentWithoutChangingIdentityAndRejectsStaleVersions() throws Exception {
        var activity = createAdminActivity(true, 1);
        mvc.perform(put(adminPath("dimensions", module)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"Interior actualizado","description":"Descripción","version":0}
                """)).andExpect(status().isNoContent());
        mvc.perform(put(adminPath("sessions", session)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("""
                {"name":"Sesión actualizada","objective":"Objetivo revisado","scheduledDate":"2026-10-02","version":0}
                """)).andExpect(status().isNoContent());
        mvc.perform(put(adminPath("activities", activity)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(editBody(0, "Nuevas instrucciones")))
                .andExpect(status().isNoContent()).andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(get(collaboratorPath()).header("Authorization", token(collaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(activity.toString()))
                .andExpect(jsonPath("$.items[0].instructions").value("Nuevas instrucciones"))
                .andExpect(jsonPath("$.items[0].dimensionName").value("Interior actualizado"))
                .andExpect(jsonPath("$.items[0].sessionName").value("Sesión actualizada"));
        mvc.perform(put(adminPath("activities", activity)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(editBody(0, "No sobrescribir")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONTENT_VERSION_CONFLICT"));
    }

    @Test void reordersActivitiesAtomicallyAndKeepsUniquePositivePositions() throws Exception {
        var first = createAdminActivity(true, 1);
        var second = createAdminActivity(true, 2);
        mvc.perform(post(adminPath("activities", second) + "/move").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"direction\":\"UP\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get(collaboratorPath()).header("Authorization", token(collaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(second.toString()))
                .andExpect(jsonPath("$.items[0].position").value(1))
                .andExpect(jsonPath("$.items[1].id").value(first.toString()))
                .andExpect(jsonPath("$.items[1].position").value(2));
        mvc.perform(post(adminPath("activities", first) + "/move").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"direction\":\"UP\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONTENT_VERSION_CONFLICT"));
    }

    @Test void reordersDimensionsAndSessionsOnlyAmongTheirSiblings() throws Exception {
        var base = consultantPath().replace("/activities", "");
        var dimResponse = mvc.perform(post(base + "/modules").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Otra\",\"position\":2}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        var dimension = UUID.fromString(json.readTree(dimResponse.getContentAsString()).path("id").asText());
        mvc.perform(post(adminPath("dimensions", dimension) + "/move").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"direction\":\"UP\"}"))
                .andExpect(status().isNoContent());
        var sessionResponse = mvc.perform(post(base + "/modules/" + module + "/sessions").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Segunda\",\"scheduledDate\":\"2026-10-02\",\"position\":2}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        var second = UUID.fromString(json.readTree(sessionResponse.getContentAsString()).path("id").asText());
        mvc.perform(post(adminPath("sessions", second) + "/move").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"direction\":\"UP\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get(base + "/modules").header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(dimension.toString()))
                .andExpect(jsonPath("$.items[1].sessions[0].id").value(second.toString()));
        assertThat(jdbcTemplate.queryForObject("select module_id from rti.program_sessions where id=?", UUID.class, second)).isEqualTo(module);
    }

    @Test void archivesPendingAssignmentsAndRestoresThemWithoutDeletingData() throws Exception {
        var activity = createAdminActivity(true, 1);
        mvc.perform(post(adminPath("dimensions", module) + "/archive").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"archived\":true}"))
                .andExpect(status().isNoContent());
        mvc.perform(get(collaboratorPath()).header("Authorization", token(collaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get(consultantPath()).header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get(consultantPath() + "?includeArchived=true").header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(activity.toString()));
        mvc.perform(post(adminPath("activities", activity) + "/archive").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"archived\":false}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONTENT_PARENT_ARCHIVED"));
        mvc.perform(post(adminPath("dimensions", module) + "/archive").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1,\"archived\":false}"))
                .andExpect(status().isNoContent());
        mvc.perform(get(collaboratorPath()).header("Authorization", token(collaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(activity.toString()));
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.activity_assignments where activity_id=?", Long.class, activity)).isEqualTo(2);
    }

    @Test void deletionRequiresNoAssignmentsAtAnyDescendant() throws Exception {
        var activity = createAdminActivity(true, 1);
        for (var target : java.util.Map.of("dimensions", module, "sessions", session, "activities", activity).entrySet()) {
            mvc.perform(post(adminPath(target.getKey(), target.getValue()) + "/delete").header("Authorization", token(consultant))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                    .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONTENT_HAS_ASSIGNMENTS"));
        }
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.program_activities where id=?", Long.class, activity)).isEqualTo(1);
    }

    @Test void deletesUnassignedSubtreeIncludingItsSurvey() throws Exception {
        var activity = createAdminActivity(false, 1);
        createAdminSurvey(activity);
        mvc.perform(post(adminPath("dimensions", module) + "/delete").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isNoContent());
        for (String table : java.util.List.of("program_modules", "program_sessions", "program_activities", "activity_evaluations", "activity_evaluation_questions")) {
            assertThat(jdbcTemplate.queryForObject("select count(*) from rti." + table + " where organization_id=?", Long.class, organization)).isZero();
        }
    }

    @Test void protectsDeliveredInstructionsSurveyAndArchiveButAllowsMetadataCorrections() throws Exception {
        var activity = createAdminActivity(true, 1);
        createAdminSurvey(activity);
        mvc.perform(post(collaboratorPath() + "/" + activity + "/submission").header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"responseText\":\"Entrega conservada\"}"))
                .andExpect(status().isOk());
        mvc.perform(put(adminPath("activities", activity)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(editBody(0, "Cambiar instrucciones")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONTENT_HAS_SUBMISSIONS"));
        mvc.perform(put(adminPath("activities", activity)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(editBody(0, "Describe tu avance.")))
                .andExpect(status().isNoContent());
        mvc.perform(put(adminPath("activities", activity) + "/survey").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(adminSurveyBody().replaceFirst("\\{", "{\"version\":0,")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONTENT_HAS_SUBMISSIONS"));
        for (var target : java.util.Map.of("dimensions", module, "sessions", session).entrySet()) {
            mvc.perform(post(adminPath(target.getKey(), target.getValue()) + "/archive").header("Authorization", token(consultant))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"archived\":true}"))
                    .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONTENT_HAS_SUBMISSIONS"));
        }
        mvc.perform(post(adminPath("activities", activity) + "/archive").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1,\"archived\":true}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONTENT_HAS_SUBMISSIONS"));
        mvc.perform(get(collaboratorPath()).header("Authorization", token(collaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].responseText").value("Entrega conservada"));
    }

    @Test void editsSurveyBeforeDeliveryAndAdvancesVersionEvenWhenOnlyQuestionsChange() throws Exception {
        var activity = createAdminActivity(true, 1);
        var original = createAdminSurvey(activity);
        mvc.perform(put(adminPath("activities", activity) + "/survey").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(adminSurveyBody().replace("¿Qué aprendiste?", "¿Qué descubriste?").replaceFirst("\\{", "{\"version\":0,")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.questions[0].prompt").value("¿Qué descubriste?"));
        var newQuestion = jdbcTemplate.queryForObject("select id from rti.activity_evaluation_questions where evaluation_id=?", UUID.class, UUID.fromString(original.path("id").asText()));
        assertThat(newQuestion.toString()).isNotEqualTo(original.path("questions").get(0).path("id").asText());
        mvc.perform(put(adminPath("activities", activity) + "/survey").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(adminSurveyBody().replaceFirst("\\{", "{\"version\":0,")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONTENT_VERSION_CONFLICT"));
    }

    @Test void duplicateCopiesDefinitionAndSurveyButNotSubmissionsAndDefaultsToNoAssignments() throws Exception {
        var activity = createAdminActivity(true, 1);
        var survey = createAdminSurvey(activity);
        mvc.perform(post(collaboratorPath() + "/" + activity + "/submission").header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"responseText\":\"No copiar\"}")).andExpect(status().isOk());
        var response = mvc.perform(post(adminPath("activities", activity) + "/duplicate").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"assignToAll\":false,\"enrollmentIds\":[]}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        var copy = UUID.fromString(json.readTree(response.getContentAsString()).path("id").asText());
        assertThat(copy).isNotEqualTo(activity);
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.activity_assignments where activity_id=?", Long.class, copy)).isZero();
        var copiedSurvey = jdbcTemplate.queryForObject("select id from rti.activity_evaluations where activity_id=?", UUID.class, copy);
        assertThat(copiedSurvey.toString()).isNotEqualTo(survey.path("id").asText());
        var copiedQuestion = jdbcTemplate.queryForObject("select id from rti.activity_evaluation_questions where evaluation_id=?", UUID.class, copiedSurvey);
        assertThat(copiedQuestion.toString()).isNotEqualTo(survey.path("questions").get(0).path("id").asText());
        mvc.perform(get(consultantPath()).header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[1].title").value("Reflexión general (copia)"))
                .andExpect(jsonPath("$.items[1].position").value(2));
    }

    @Test void duplicateCanAssignSelectedCollaboratorsAndDoesNotExposeOtherOrganizations() throws Exception {
        var activity = createAdminActivity(false, 1);
        mvc.perform(post(adminPath("activities", activity) + "/duplicate").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"assignToAll\":false,\"enrollmentIds\":[\"" + enrollment + "\"]}"))
                .andExpect(status().isCreated());
        mvc.perform(post(adminPath("activities", activity) + "/delete").header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isForbidden());
        mvc.perform(post(adminPath("activities", activity) + "/delete").contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":0}")).andExpect(status().isUnauthorized());
        mvc.perform(put(adminPath("activities", uuid7(0xeff))).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(editBody(0, "No existe"))).andExpect(status().isNotFound());
        mvc.perform(put(adminPath("activities", activity).replace(organization.toString(), uuid7(0xefe).toString()))
                .header("Authorization", token(consultant)).contentType(MediaType.APPLICATION_JSON).content(editBody(0, "Ajeno")))
                .andExpect(status().isNotFound());
        mvc.perform(get(collaboratorPath()).header("Authorization", token(collaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(get(collaboratorPath()).header("Authorization", token(otherCollaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
    }

    @Test void completedProgramRejectsAllContentAdministration() throws Exception {
        var activity = createAdminActivity(true, 1);
        createAdminSurvey(activity);
        mvc.perform(post(consultantPath().replace("/activities", "/status")).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"COMPLETED\",\"version\":0}"))
                .andExpect(status().isOk());
        for (String action : java.util.List.of("delete", "archive", "move", "duplicate")) {
            mvc.perform(post(adminPath("activities", activity) + "/" + action).header("Authorization", token(consultant))
                    .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"archived\":true,\"direction\":\"UP\",\"assignToAll\":false,\"enrollmentIds\":[]}"))
                    .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_READ_ONLY"));
        }
        mvc.perform(put(adminPath("activities", activity)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(editBody(0, "Bloqueada")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_READ_ONLY"));
    }

    @Test void restoringParentPreservesTheOwnArchiveFlagOfItsChildren() throws Exception {
        var archived = createAdminActivity(true, 1);
        var visible = createAdminActivity(true, 2);
        mvc.perform(post(adminPath("activities", archived) + "/archive").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"archived\":true}")).andExpect(status().isNoContent());
        mvc.perform(post(adminPath("dimensions", module) + "/archive").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"archived\":true}")).andExpect(status().isNoContent());
        mvc.perform(post(adminPath("dimensions", module) + "/archive").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1,\"archived\":false}")).andExpect(status().isNoContent());
        mvc.perform(get(collaboratorPath()).header("Authorization", token(collaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(visible.toString()));
        mvc.perform(post(collaboratorPath() + "/" + archived + "/submission").header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"responseText\":\"No guardar en archivada\"}"))
                .andExpect(status().isNotFound());
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.activity_assignments where activity_id=? and submitted_at is not null", Long.class, archived)).isZero();
    }

    @Test void cannotAddASurveyRetroactivelyAfterTheFirstSubmission() throws Exception {
        var activity = createAdminActivity(true, 1);
        mvc.perform(post(collaboratorPath() + "/" + activity + "/submission").header("Authorization", token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"responseText\":\"Entrega sin encuesta\"}")).andExpect(status().isOk());
        mvc.perform(post(evaluationPath(activity)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(adminSurveyBody()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONTENT_HAS_SUBMISSIONS"));
        mvc.perform(post(adminPath("activities", activity) + "/duplicate").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"assignToAll\":true,\"enrollmentIds\":[]}"))
                .andExpect(status().isCreated());
        mvc.perform(get(consultantPath()).header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[1].assignees.length()").value(2))
                .andExpect(jsonPath("$.items[1].assignees[0].status").value("ASSIGNED"))
                .andExpect(jsonPath("$.items[1].assignees[0].submittedAt").doesNotExist());
    }

    @Test void surveyResultsAggregateScalesSeparatelyAndCompareTheFullHierarchy() throws Exception {
        var first = createAdminActivity(true, 1);
        var firstSurvey = createResultsSurvey(first);
        sendResults(collaborator, first, firstSurvey, "4", "5", "=1+1", java.util.List.of("Inspirado(a)", "Motivado(a)"));
        sendResults(otherCollaborator, first, firstSurvey, "2", "3", "Aprendí a escuchar", java.util.List.of("Inspirado(a)"));
        var otherDimension = uuid7(0xe21); var otherSession = uuid7(0xe22);
        jdbcTemplate.update("""
                insert into rti.program_modules (id,organization_id,program_id,name,position,created_at,updated_at,version)
                values (?,?,?,'Exterior',2,now(),now(),0)
                """, otherDimension, organization, program);
        jdbcTemplate.update("""
                insert into rti.program_sessions (id,organization_id,program_id,module_id,name,scheduled_date,position,created_at,updated_at,version)
                values (?,?,?,?,'Segunda sesión','2026-10-02',1,now(),now(),0)
                """, otherSession, organization, program, otherDimension);
        var response = mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(allBody().replace(session.toString(), otherSession.toString())))
                .andExpect(status().isCreated()).andReturn().getResponse();
        var second = UUID.fromString(json.readTree(response.getContentAsString()).path("id").asText());
        var secondSurvey = createResultsSurvey(second);
        sendResults(collaborator, second, secondSurvey, "1", "1", "Otro aprendizaje", java.util.List.of("Reflexivo(a)"));

        mvc.perform(get(resultsPath()).header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.summary.surveyCount").value(2)).andExpect(jsonPath("$.summary.assignedCount").value(4))
                .andExpect(jsonPath("$.summary.responseCount").value(3)).andExpect(jsonPath("$.summary.pendingCount").value(1))
                .andExpect(jsonPath("$.summary.participantCount").value(2)).andExpect(jsonPath("$.summary.respondentCount").value(2))
                .andExpect(jsonPath("$.summary.responseRate").value(75.0))
                .andExpect(jsonPath("$.summary.agreementAverage").value(2.33)).andExpect(jsonPath("$.summary.agreementAnswers").value(3))
                .andExpect(jsonPath("$.summary.likelihoodAverage").value(3.0))
                .andExpect(jsonPath("$.dimensions.length()").value(2)).andExpect(jsonPath("$.sessions.length()").value(2))
                .andExpect(jsonPath("$.activities.length()").value(2))
                .andExpect(jsonPath("$.dimensions[0].summary.agreementAverage").value(3.0))
                .andExpect(jsonPath("$.dimensions[1].summary.agreementAverage").value(1.0))
                .andExpect(jsonPath("$.surveys[0].questions[0].average").value(3.0))
                .andExpect(jsonPath("$.surveys[0].questions[0].distribution[0].count").value(0))
                .andExpect(jsonPath("$.surveys[0].questions[0].distribution[1].count").value(1))
                .andExpect(jsonPath("$.surveys[0].questions[0].distribution[3].percentage").value(50.0))
                .andExpect(jsonPath("$.surveys[0].questions[3].distribution[0].value").value("Inspirado(a)"))
                .andExpect(jsonPath("$.surveys[0].questions[3].distribution[0].count").value(2))
                .andExpect(jsonPath("$.surveys[0].questions[3].distribution[0].percentage").value(100.0))
                .andExpect(jsonPath("$.surveys[0].questions[3].distribution[1].percentage").value(50.0))
                .andExpect(jsonPath("$.surveys[0].responses.length()").value(2))
                .andExpect(jsonPath("$.surveys[0].responses[0].email").isNotEmpty())
                .andExpect(jsonPath("$.surveys[0].responses[0].responseText").doesNotExist());
        mvc.perform(get(resultsPath()).param("dimensionId", otherDimension.toString()).param("sessionId", otherSession.toString())
                .param("activityId", second.toString()).header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary.responseCount").value(1))
                .andExpect(jsonPath("$.summary.assignedCount").value(2)).andExpect(jsonPath("$.summary.agreementAverage").value(1.0))
                .andExpect(jsonPath("$.options.length()").value(2)).andExpect(jsonPath("$.surveys.length()").value(1));
        mvc.perform(get(resultsPath()).param("dimensionId", module.toString()).param("activityId", second.toString())
                .header("Authorization", token(consultant))).andExpect(status().isNotFound());
    }

    @Test void surveyResultsUseNullNotZeroForMissingAveragesAndIgnoreArchivedPendingWork() throws Exception {
        var first = createAdminActivity(true, 1); createResultsSurvey(first);
        mvc.perform(get(resultsPath()).header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary.assignedCount").value(2))
                .andExpect(jsonPath("$.summary.responseCount").value(0)).andExpect(jsonPath("$.summary.pendingCount").value(2))
                .andExpect(jsonPath("$.summary.responseRate").value(0.0))
                .andExpect(jsonPath("$.summary.agreementAverage").isEmpty())
                .andExpect(jsonPath("$.surveys[0].questions[0].distribution.length()").value(5))
                .andExpect(jsonPath("$.surveys[0].questions[0].distribution[0].percentage").value(0.0));
        mvc.perform(post(adminPath("activities", first) + "/archive").header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"archived\":true}")).andExpect(status().isNoContent());
        mvc.perform(get(resultsPath()).header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary.surveyCount").value(0))
                .andExpect(jsonPath("$.summary.responseRate").isEmpty()).andExpect(jsonPath("$.surveys").isEmpty());
    }

    @Test void surveyResultsAndExportRequireConsultantAndRejectForeignScopes() throws Exception {
        var activity = createAdminActivity(true, 1); createResultsSurvey(activity);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'LEADER'), (?, 'COMPANY_ADMIN')", collaboratorMembership, collaboratorMembership);
        for (String suffix : java.util.List.of("", "/export")) {
            mvc.perform(get(resultsPath() + suffix)).andExpect(status().isUnauthorized());
            mvc.perform(get(resultsPath() + suffix).header("Authorization", token(collaborator))).andExpect(status().isForbidden());
            mvc.perform(get(resultsPath() + suffix).param("activityId", uuid7(0xefe).toString()).header("Authorization", token(consultant)))
                    .andExpect(status().isNotFound());
            mvc.perform(get(resultsPath() + suffix).param("activityId", "not-a-uuid").header("Authorization", token(consultant)))
                    .andExpect(status().isBadRequest());
        }
        var otherOrg = uuid7(0xe31); var membership = uuid7(0xe32);
        insertOrganization(otherOrg); insertMembership(membership, otherOrg, consultant);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'CONSULTANT')", membership);
        mvc.perform(get(resultsPath().replace(organization.toString(), otherOrg.toString())).header("Authorization", token(consultant)))
                .andExpect(status().isNotFound());
    }

    @Test void exportsFilteredSurveyAnswersAndAggregatesWithSpreadsheetProtectionAfterProgramClosure() throws Exception {
        var activity = createAdminActivity(true, 1); var survey = createResultsSurvey(activity);
        sendResults(collaborator, activity, survey, "5", "4", "=1+1", java.util.List.of("Inspirado(a)", "Motivado(a)"));
        mvc.perform(post(consultantPath().replace("/activities", "/status")).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"COMPLETED\",\"version\":0}")).andExpect(status().isOk());
        var csv = mvc.perform(get(resultsPath() + "/export").param("activityId", activity.toString()).header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment")))
                .andExpect(content().contentTypeCompatibleWith("text/csv")).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(csv).startsWith("\uFEFF").contains("Comparación dimensión", "Distribución pregunta", "Promedio pregunta", "Inspirado(a)", "'=1+1");
        assertThat(csv).doesNotContain("Entrega privada para revisión");
        mvc.perform(get(resultsPath()).header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary.responseCount").value(1));
        assertThat(jdbcTemplate.queryForObject("select answer_value from rti.activity_evaluation_answers where question_id=?", String.class,
                UUID.fromString(survey.path("questions").get(2).path("id").asText()))).isEqualTo("=1+1");
    }

    @Test void suspensionWithdrawAndReinstatementControlExistingTokensWithoutDeletingWork() throws Exception {
        var activity=createAdminActivity(true,1); var survey=createResultsSurvey(activity);
        sendResults(collaborator,activity,survey,"4","5","Respuesta conservada",java.util.List.of("Inspirado(a)"));
        changeParticipant(enrollment,0,"SUSPEND").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SUSPENDED"));
        mvc.perform(get(collaboratorPath()).header("Authorization",token(collaborator))).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/me/programs/"+program).header("Authorization",token(collaborator))).andExpect(status().isNotFound());
        mvc.perform(post(collaboratorPath()+"/"+activity+"/submission").header("Authorization",token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"responseText\":\"No guardar\"}")).andExpect(status().isNotFound());
        changeParticipant(enrollment,1,"REINSTATE").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(get(collaboratorPath()).header("Authorization",token(collaborator))).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].responseText").value("Entrega privada para revisión"))
                .andExpect(jsonPath("$.items[0].completionPercentage").value(100));
        changeParticipant(enrollment,2,"WITHDRAW").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("WITHDRAWN"));
        mvc.perform(get(collaboratorPath()).header("Authorization",token(collaborator))).andExpect(status().isNotFound());
        mvc.perform(get(collaboratorPath()).header("Authorization",token(otherCollaborator))).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.activity_evaluation_responses where enrollment_id=?",Long.class,enrollment)).isEqualTo(1);
        mvc.perform(get(participantPath(enrollment)+"/history").header("Authorization",token(consultant))).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3)).andExpect(jsonPath("$.items[0].action").value("WITHDRAW"))
                .andExpect(jsonPath("$.items[0].previousStatus").value("ACTIVE")).andExpect(jsonPath("$.items[0].actorLabel").isNotEmpty());
    }

    @Test void completingWithPendingSurveyIsReadOnlyAndReinstatementPreservesTheFiftyPercent() throws Exception {
        var activity=createAdminActivity(true,1); var survey=createResultsSurvey(activity);
        mvc.perform(post(collaboratorPath()+"/"+activity+"/submission").header("Authorization",token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"responseText\":\"Mi entrega\"}")).andExpect(status().isOk());
        changeParticipant(enrollment,0,"COMPLETE").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
        mvc.perform(get("/api/v1/me/programs/"+program).header("Authorization",token(collaborator))).andExpect(status().isOk())
                .andExpect(jsonPath("$.enrollmentStatus").value("COMPLETED"));
        mvc.perform(get(collaboratorPath()).header("Authorization",token(collaborator))).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].completionPercentage").value(50));
        mvc.perform(post(surveyResponsePath(activity)).header("Authorization",token(collaborator)).contentType(MediaType.APPLICATION_JSON)
                .content(surveyResponseBody(survey))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PARTICIPATION_READ_ONLY"));
        changeParticipant(enrollment,1,"REINSTATE").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(post(surveyResponsePath(activity)).header("Authorization",token(collaborator)).contentType(MediaType.APPLICATION_JSON)
                .content(surveyResponseBody(survey))).andExpect(status().isOk());
        mvc.perform(get(collaboratorPath()).header("Authorization",token(collaborator))).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].completionPercentage").value(100));
    }

    @Test void aSuspendedCompletedEnrollmentRestoresReadOnlyRatherThanActiveAccess() throws Exception {
        changeParticipant(enrollment,0,"COMPLETE").andExpect(status().isOk());
        changeParticipant(enrollment,1,"SUSPEND").andExpect(status().isOk()).andExpect(jsonPath("$.suspendedFromStatus").value("COMPLETED"));
        changeParticipant(enrollment,2,"REINSTATE").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
    }

    @Test void withdrawingLeaderAlsoRemovesBasicProgramMetadataButNotOtherPrograms() throws Exception {
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'LEADER')",collaboratorMembership);
        var otherProgram=uuid7(0xea1); var otherParticipant=uuid7(0xea2);
        insertProgram(otherProgram,organization);
        tenantContext.activate(organization);
        jdbcTemplate.update("""
                insert into rti.enrollments (id,organization_id,program_id,participant_membership_id,status,created_at,updated_at,version)
                values (?,?,?,?,'ACTIVE',now(),now(),0)
                """,otherParticipant,organization,otherProgram,collaboratorMembership);
        changeParticipant(enrollment,0,"WITHDRAW").andExpect(status().isOk());
        var base=consultantPath().replace("/activities","");
        mvc.perform(get(base).header("Authorization",token(collaborator))).andExpect(status().isNotFound());
        mvc.perform(get(base.replace("/"+program,"")).param("size","1").header("Authorization",token(collaborator)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.items[0].id").value(otherProgram.toString()));
        mvc.perform(get("/api/v1/me/programs/"+otherProgram).header("Authorization",token(collaborator))).andExpect(status().isOk());
        mvc.perform(get(base+"/disc-profiles").header("Authorization",token(collaborator))).andExpect(status().isForbidden());
    }

    @Test void organizationRoleChangesAreVersionedAndVisibleInTheOtherEnrollmentHistory() throws Exception {
        var otherProgram=uuid7(0xeb1);var otherParticipant=uuid7(0xeb2);
        insertProgram(otherProgram,organization);tenantContext.activate(organization);
        jdbcTemplate.update("""
                insert into rti.enrollments (id,organization_id,program_id,participant_membership_id,status,created_at,updated_at,version)
                values (?,?,?,?,'ACTIVE',now(),now(),0)
                """,otherParticipant,organization,otherProgram,collaboratorMembership);
        mvc.perform(post(participantPath(enrollment)+"/administration").header("Authorization",token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(participantBody(0,"CHANGE_ROLE") .replace("\"confirmed\":true","\"confirmed\":true,\"role\":\"LEADER\",\"roleVersion\":0")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.access.roles[0]").value("LEADER")).andExpect(jsonPath("$.access.version").value(1));
        mvc.perform(get("/api/v1/me/programs").header("Authorization",token(collaborator))).andExpect(status().isForbidden());
        mvc.perform(get(participantPath(otherParticipant).replace(program.toString(),otherProgram.toString())+"/history").header("Authorization",token(consultant)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.items[0].action").value("CHANGE_ROLE"))
                .andExpect(jsonPath("$.items[0].programId").value(program.toString()));
        mvc.perform(post(participantPath(enrollment)+"/administration").header("Authorization",token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(participantBody(1,"CHANGE_ROLE").replace("\"confirmed\":true","\"confirmed\":true,\"role\":\"COLLABORATOR\",\"roleVersion\":0")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MEMBERSHIP_VERSION_CONFLICT"));
        mvc.perform(post(participantPath(enrollment)+"/administration").header("Authorization",token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(participantBody(1,"CHANGE_ROLE").replace("\"confirmed\":true","\"confirmed\":true,\"role\":\"COLLABORATOR\",\"roleVersion\":1")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.access.roles[0]").value("COLLABORATOR"));
        assertThat(jdbcTemplate.queryForObject("select profile_status from rti.organization_memberships where id=?",String.class,collaboratorMembership)).isEqualTo("COMPLETE");
    }

    @Test void participantAdministrationRequiresConfirmationScopeAndConsultantAndProtectsAdministrativeUsers() throws Exception {
        mvc.perform(post(participantPath(enrollment)+"/administration").contentType(MediaType.APPLICATION_JSON).content(participantBody(0,"SUSPEND"))).andExpect(status().isUnauthorized());
        mvc.perform(post(participantPath(enrollment)+"/administration").header("Authorization",token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content(participantBody(0,"SUSPEND"))).andExpect(status().isForbidden());
        mvc.perform(get(participantPath(enrollment)+"/history").header("Authorization",token(collaborator))).andExpect(status().isForbidden());
        mvc.perform(post(participantPath(enrollment)+"/administration").header("Authorization",token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(participantBody(0,"SUSPEND").replace("\"confirmed\":true","\"confirmed\":false")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ENROLLMENT_CONFIRMATION_REQUIRED"));
        mvc.perform(post(participantPath(enrollment)+"/administration").header("Authorization",token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(participantBody(0,"CHANGE_ROLE").replace("\"confirmed\":true","\"confirmed\":true,\"role\":\"CONSULTANT\",\"roleVersion\":0")))
                .andExpect(status().isBadRequest());
        mvc.perform(post(participantPath(uuid7(0xeff))+"/administration").header("Authorization",token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(participantBody(0,"SUSPEND"))).andExpect(status().isNotFound());
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'CONSULTANT')",collaboratorMembership);
        changeParticipant(enrollment,0,"WITHDRAW").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PARTICIPANT_ADMINISTRATIVE_ACCESS"));
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.enrollment_changes where enrollment_id=?",Long.class,enrollment)).isZero();
    }

    @Test void staleOrInvalidTransitionsDoNotCreateAdditionalHistory() throws Exception {
        changeParticipant(enrollment,0,"SUSPEND").andExpect(status().isOk());
        changeParticipant(enrollment,0,"WITHDRAW").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ENROLLMENT_VERSION_CONFLICT"));
        changeParticipant(enrollment,1,"COMPLETE").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ENROLLMENT_TRANSITION_NOT_ALLOWED"));
        changeParticipant(enrollment,1,"REVOKE").andExpect(status().isConflict());
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.enrollment_changes where enrollment_id=?",Long.class,enrollment)).isEqualTo(1);
    }

    @Test void restrictingAccessRemainsPossibleAfterProgramClosureButReinstatementDoesNotReopenIt() throws Exception {
        mvc.perform(post(consultantPath().replace("/activities","/status")).header("Authorization",token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"COMPLETED\",\"version\":0}")).andExpect(status().isOk());
        changeParticipant(enrollment,0,"SUSPEND").andExpect(status().isOk());
        changeParticipant(enrollment,1,"REINSTATE").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_READ_ONLY"));
        changeParticipant(enrollment,1,"WITHDRAW").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("WITHDRAWN"));
        mvc.perform(get(participantPath(enrollment)+"/history").header("Authorization",token(consultant))).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"UPDATE","DELETE"})
    void enrollmentHistoryIsTenantIsolatedAndImmutableForTheRuntimeRole(String operation) throws Exception {
        changeParticipant(enrollment,0,"SUSPEND").andExpect(status().isOk());
        tenantContext.activate(uuid7(0xeec));
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.enrollment_changes where enrollment_id=?",Long.class,enrollment)).isZero();
        tenantContext.activate(organization);
        org.assertj.core.api.Assertions.assertThatThrownBy(()->jdbcTemplate.update(operation.equals("UPDATE")
                ?"update rti.enrollment_changes set reason='No permitido' where enrollment_id=?"
                :"delete from rti.enrollment_changes where enrollment_id=?",enrollment)).isInstanceOf(org.springframework.dao.DataAccessException.class);
    }

    private String participantPath(UUID id) {return consultantPath().replace("/activities","/enrollments/"+id);}
    private String participantBody(long version,String action) {return "{\"version\":"+version+",\"action\":\""+action+"\",\"reason\":\"Cambio de prueba\",\"confirmed\":true}";}
    private org.springframework.test.web.servlet.ResultActions changeParticipant(UUID id,long version,String action) throws Exception {
        return mvc.perform(post(participantPath(id)+"/administration").header("Authorization",token(consultant)).contentType(MediaType.APPLICATION_JSON).content(participantBody(version,action)));
    }

    private String resultsPath() { return consultantPath().replace("/activities", "/survey-results"); }
    private tools.jackson.databind.JsonNode createResultsSurvey(UUID activity) throws Exception {
        var response = mvc.perform(post(evaluationPath(activity)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("""
                {"title":"Encuesta de experiencia","instructions":"Responde","questions":[
                  {"prompt":"¿Estás de acuerdo?","type":"AGREEMENT_SCALE","position":1},
                  {"prompt":"¿Lo aplicarás?","type":"LIKELIHOOD_SCALE","position":2},
                  {"prompt":"¿Qué aprendiste?","type":"OPEN_TEXT","position":3},
                  {"prompt":"¿Cómo te sientes?","type":"EMOTION_MULTI_SELECT","position":4}]}
                """)).andExpect(status().isCreated()).andReturn().getResponse();
        return json.readTree(response.getContentAsString());
    }
    private void sendResults(UUID actor, UUID activity, tools.jackson.databind.JsonNode survey, String agreement, String likelihood, String open, java.util.List<String> emotions) throws Exception {
        mvc.perform(post(collaboratorPath() + "/" + activity + "/submission").header("Authorization", token(actor))
                .contentType(MediaType.APPLICATION_JSON).content("{\"responseText\":\"Entrega privada para revisión\"}")).andExpect(status().isOk());
        var values = java.util.List.of(java.util.List.of(agreement), java.util.List.of(likelihood), java.util.List.of(open), emotions);
        var answers = java.util.stream.IntStream.range(0, 4).mapToObj(i -> java.util.Map.of("questionId", survey.path("questions").get(i).path("id").asText(), "values", values.get(i))).toList();
        mvc.perform(post(surveyResponsePath(activity)).header("Authorization", token(actor))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(java.util.Map.of("answers", answers)))).andExpect(status().isOk());
    }

    @Test void notificationsArePrivatePersistentAndReadIdempotently() throws Exception {
        createAdminActivity(true, 1);
        var own = inbox(collaborator);
        assertThat(own.path("unreadCount").asLong()).isEqualTo(1);
        var id = own.path("items").get(0).path("id").asText();
        assertThat(own.path("items").get(0).path("kind").asText()).isEqualTo("ACTIVITY_ASSIGNED");
        assertThat(inbox(consultant).path("items").size()).isZero();
        mvc.perform(post("/api/v1/me/notifications/"+id+"/read").header("Authorization",token(otherCollaborator)))
                .andExpect(status().isNotFound());
        for(int i=0;i<2;i++) mvc.perform(post("/api/v1/me/notifications/"+id+"/read").header("Authorization",token(collaborator)))
                .andExpect(status().isNoContent()).andExpect(header().string("Cache-Control","no-store"));
        assertThat(inbox(collaborator).path("unreadCount").asLong()).isZero();
        assertThat(inbox(collaborator).path("items").get(0).path("readAt").isNull()).isFalse();
        assertThat(inbox(otherCollaborator).path("unreadCount").asLong()).isEqualTo(1);
        mvc.perform(get("/api/v1/me/notifications")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/me/notifications/"+id+"/read")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/me/notifications?beforeId="+id).header("Authorization",token(collaborator)))
                .andExpect(status().isBadRequest());
    }

    @Test void notificationDeliveryFollowsAssignmentsSubmissionsAndReviewsWithoutDuplicates() throws Exception {
        var activity=createAdminActivity(true,1);
        var assignment=jdbcTemplate.queryForObject("select id from rti.activity_assignments where activity_id=? and enrollment_id=?",UUID.class,activity,enrollment);
        notifications.record(organization,assignment,com.reflejatuinterior.participation.application.Notifications.Kind.ACTIVITY_ASSIGNED);
        assertThat(inbox(collaborator).path("items").size()).isEqualTo(1);
        submitNotificationActivity(activity);
        var received=inbox(consultant);
        assertThat(received.path("unreadCount").asLong()).isEqualTo(1);
        assertThat(received.path("items").get(0).path("kind").asText()).isEqualTo("SUBMISSION_RECEIVED");
          assertThat(received.path("items").get(0).path("participantName").asText()).isEqualTo(collaborator+"@example.test");
        assertThat(received.toString()).doesNotContain("responseText","reviewComment");
        mvc.perform(post(reviewPath(activity,assignment)).header("Authorization",token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"REQUEST_CHANGES\",\"comment\":\"Ajusta la respuesta\"}"))
                .andExpect(status().isOk());
        assertThat(inbox(consultant).path("items").size()).isZero();
        assertThat(inbox(collaborator).toString()).contains("CHANGES_REQUESTED");
        submitNotificationActivity(activity);
        assertThat(inbox(consultant).path("items").size()).isEqualTo(1);
        assertThat(inbox(consultant).path("items").get(0).path("id").asText())
                .isNotEqualTo(received.path("items").get(0).path("id").asText());
        mvc.perform(post(reviewPath(activity,assignment)).header("Authorization",token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content("{\"decision\":\"APPROVE\"}"))
                .andExpect(status().isOk());
        assertThat(inbox(collaborator).toString()).contains("ACTIVITY_APPROVED");
        assertThat(inbox(otherCollaborator).toString()).doesNotContain("ACTIVITY_APPROVED","CHANGES_REQUESTED");
    }

    @Test void surveyReminderDisappearsWhenSurveyIsCompleted() throws Exception {
        var activity=createAdminActivity(true,1);
        var survey=createAdminSurvey(activity);
        submitNotificationActivity(activity);
        assertThat(inbox(collaborator).toString()).contains("SURVEY_PENDING");
        var question=survey.path("questions").get(0).path("id").asText();
        mvc.perform(post(surveyResponsePath(activity)).header("Authorization",token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"answers\":[{\"questionId\":\""+question+"\",\"values\":[\"Aprendizaje\"]}]}"))
                .andExpect(status().isOk());
        assertThat(inbox(collaborator).toString()).doesNotContain("SURVEY_PENDING");
    }

    @Test void notificationsRespectDraftClosedArchivedAndSuspendedStates() throws Exception {
        jdbcTemplate.update("update rti.programs set status='DRAFT' where id=?",program);
        var activity=createAdminActivity(true,1);
        assertThat(inbox(collaborator).path("items").size()).isZero();
        jdbcTemplate.update("update rti.programs set status='ACTIVE' where id=?",program);
        var notification=inbox(collaborator).path("items").get(0).path("id").asText();
        jdbcTemplate.update("update rti.enrollments set status='SUSPENDED',suspended_from_status='ACTIVE' where id=?",enrollment);
        assertThat(inbox(collaborator).path("unreadCount").asLong()).isZero();
        mvc.perform(post("/api/v1/me/notifications/"+notification+"/read").header("Authorization",token(collaborator)))
                .andExpect(status().isNotFound());
        jdbcTemplate.update("update rti.enrollments set status='ACTIVE',suspended_from_status=NULL where id=?",enrollment);
        assertThat(inbox(collaborator).path("unreadCount").asLong()).isEqualTo(1);
        jdbcTemplate.update("update rti.program_activities set archived=true where id=?",activity);
        assertThat(inbox(collaborator).path("items").size()).isZero();
        jdbcTemplate.update("update rti.program_activities set archived=false where id=?",activity);
        jdbcTemplate.update("update rti.programs set status='COMPLETED' where id=?",program);
        assertThat(inbox(collaborator).path("items").size()).isZero();
    }

    @Test void notificationAccessIsRecheckedAfterMembershipRoleAndProfileChanges() throws Exception {
        var activity=createAdminActivity(true,1);
        submitNotificationActivity(activity);
        assertThat(inbox(consultant).path("items").size()).isEqualTo(1);
        jdbcTemplate.update("update rti.membership_roles set role='COMPANY_ADMIN' where membership_id=?",consultantMembership);
        assertThat(inbox(consultant).path("items").size()).isZero();
        jdbcTemplate.update("update rti.organization_memberships set profile_status='PENDING' where id=?",collaboratorMembership);
        assertThat(inbox(collaborator).path("items").size()).isZero();
        jdbcTemplate.update("update rti.organization_memberships set profile_status='COMPLETE',status='REVOKED' where id=?",collaboratorMembership);
        assertThat(inbox(collaborator).path("items").size()).isZero();
        jdbcTemplate.update("update rti.users set status='DEACTIVATED' where id=?",collaborator);
        mvc.perform(get("/api/v1/me/notifications").header("Authorization",token(collaborator))).andExpect(status().isForbidden());
    }

    @Test void notificationTableAndInboxAreTenantIsolated() throws Exception {
        createAdminActivity(true,1);
        var otherOrg=uuid7(0xdfe);
        insertOrganization(otherOrg);
        tenantContext.activate(otherOrg);
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.activity_notifications",Long.class)).isZero();
        tenantContext.activate(organization);
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.activity_notifications",Long.class)).isEqualTo(2);
        var alien=uuid7(0xdfa); var alienMembership=uuid7(0xdfb);
        insertUser(alien); insertMembership(alienMembership,otherOrg,alien);
        jdbcTemplate.update("insert into rti.membership_roles values (?,'CONSULTANT')",alienMembership);
        assertThat(inbox(alien).path("items").size()).isZero();
    }

    @Test void notificationKeysetPaginationPreservesEqualTimestampItemsAndExactUnreadCount() throws Exception {
        createAdminActivity(true,1);
        var first=inbox(collaborator).path("items").get(0);
        var assignment=UUID.fromString(first.path("assignmentId").asText());
        for(int i=1;i<25;i++) jdbcTemplate.update("""
                insert into rti.activity_notifications(organization_id,program_id,assignment_id,recipient_membership_id,kind,source_version)
                values(?,?,?,?,'ACTIVITY_ASSIGNED',?)
                """,organization,program,assignment,collaboratorMembership,i);
        var page=inbox(collaborator);
        assertThat(page.path("items").size()).isEqualTo(20);
        assertThat(page.path("unreadCount").asLong()).isEqualTo(25);
        assertThat(page.path("hasMore").asBoolean()).isTrue();
        var last=page.path("items").get(19);
        var second=mvc.perform(get("/api/v1/me/notifications").param("before",last.path("createdAt").asText())
                .param("beforeId",last.path("id").asText()).header("Authorization",token(collaborator)))
                .andExpect(status().isOk()).andReturn().getResponse();
        var tail=json.readTree(second.getContentAsString());
        assertThat(tail.path("items").size()).isEqualTo(5);
        assertThat(tail.path("hasMore").asBoolean()).isFalse();
        var ids=new java.util.HashSet<String>();
        page.path("items").forEach(n -> ids.add(n.path("id").asText()));
        tail.path("items").forEach(n -> assertThat(ids.add(n.path("id").asText())).isTrue());
    }

    private tools.jackson.databind.JsonNode inbox(UUID user) throws Exception {
        var result=mvc.perform(get("/api/v1/me/notifications").header("Authorization",token(user)))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
                .andReturn().getResponse();
        return json.readTree(result.getContentAsString());
    }
    private void submitNotificationActivity(UUID activity) throws Exception {
        mvc.perform(post(collaboratorPath()+"/"+activity+"/submission").header("Authorization",token(collaborator))
                .contentType(MediaType.APPLICATION_JSON).content("{\"responseText\":\"Respuesta privada\"}"))
                .andExpect(status().isOk());
    }

    private UUID createAdminActivity(boolean assigned, int position) throws Exception {
        if (!assigned) jdbcTemplate.update("update rti.enrollments set status='INVITED' where program_id=?", program);
        var response = mvc.perform(post(consultantPath()).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(allBody().replace("\"position\":1", "\"position\":" + position)))
                .andExpect(status().isCreated()).andReturn().getResponse();
        if (!assigned) jdbcTemplate.update("update rti.enrollments set status='ACTIVE' where program_id=?", program);
        return UUID.fromString(json.readTree(response.getContentAsString()).path("id").asText());
    }
    private tools.jackson.databind.JsonNode createAdminSurvey(UUID activity) throws Exception {
        var response = mvc.perform(post(evaluationPath(activity)).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(adminSurveyBody()))
                .andExpect(status().isCreated()).andReturn().getResponse();
        return json.readTree(response.getContentAsString());
    }
    private String adminSurveyBody() { return """
            {"title":"Encuesta","instructions":"Responde","questions":[{"prompt":"¿Qué aprendiste?","type":"OPEN_TEXT","position":1}]}
            """; }
    private String editBody(long version, String instructions) {
        return "{\"title\":\"Actividad corregida\",\"instructions\":\"" + instructions + "\",\"youtubeUrl\":\"https://youtu.be/dQw4w9WgXcQ\",\"dueDate\":\"2026-11-01\",\"version\":" + version + "}";
    }
    private String adminPath(String kind, UUID id) {
        return consultantPath().replace("/activities", "/content/") + kind + "/" + id;
    }

    private String consultantPath() {
        return "/api/v1/organizations/" + organization + "/programs/" + program + "/activities";
    }
    private String collaboratorPath() { return "/api/v1/me/programs/" + program + "/activities"; }
    private String evaluationsPath() {
        return "/api/v1/organizations/" + organization + "/programs/" + program + "/evaluations";
    }
    private String evaluationPath(UUID activityId) {
        return consultantPath() + "/" + activityId + "/evaluation";
    }
    private String surveyResponsePath(UUID activityId) {
        return collaboratorPath() + "/" + activityId + "/survey-response";
    }
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
    private String surveyResponseBody(tools.jackson.databind.JsonNode evaluation) {
        return "{\"answers\":["
                + "{\"questionId\":\"" + evaluation.path("questions").get(0).path("id").asText() + "\",\"values\":[\"4\"]},"
                + "{\"questionId\":\"" + evaluation.path("questions").get(1).path("id").asText() + "\",\"values\":[\"5\"]},"
                + "{\"questionId\":\"" + evaluation.path("questions").get(2).path("id").asText() + "\",\"values\":[\"Aprendí a reconocer mis fortalezas.\"]},"
                + "{\"questionId\":\"" + evaluation.path("questions").get(3).path("id").asText() + "\",\"values\":[\"Inspirado(a)\",\"Reflexivo(a)\"]}]}";
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
