package com.reflejatuinterior.identity.infrastructure.security;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@AutoConfigureMockMvc
@Transactional
@Import(CognitoAuthenticationIntegrationTests.JwtTestConfiguration.class)
class CollaboratorProgramIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID organizationA = uuid7(0xb01), organizationB = uuid7(0xb02);
    private final UUID collaborator = uuid7(0xb03), otherUser = uuid7(0xb04);
    private final UUID membershipA = uuid7(0xb05), membershipB = uuid7(0xb06), otherMembership = uuid7(0xb07);
    private final UUID ownActive = uuid7(0xb08), ownCompleted = uuid7(0xb09), invited = uuid7(0xb0a);
    private final UUID withdrawn = uuid7(0xb0b), anotherPersons = uuid7(0xb0c);

    @Autowired MockMvc mvc;
    @Autowired JwtEncoder encoder;
    private String accessToken;

    @BeforeEach
    void setup() {
        insertOrganization(organizationA);
        insertOrganization(organizationB);
        insertUser(collaborator);
        insertUser(otherUser);
        insertMembership(membershipA, organizationA, collaborator);
        insertMembership(membershipB, organizationB, collaborator);
        insertMembership(otherMembership, organizationA, otherUser);
        addRole(membershipA, "COLLABORATOR");
        addRole(membershipB, "COLLABORATOR");
        addRole(otherMembership, "COLLABORATOR");
        insertProgram(ownActive, organizationA);
        insertProgram(ownCompleted, organizationB);
        insertProgram(invited, organizationA);
        insertProgram(withdrawn, organizationB);
        insertProgram(anotherPersons, organizationA);
        programDetails(ownActive, "Tu historia, tu mayor diferencial", "Programa asignado", "2026-09-01", "2026-12-01");
        enrollment(uuid7(0xb10), organizationA, ownActive, membershipA, "ACTIVE");
        enrollment(uuid7(0xb11), organizationB, ownCompleted, membershipB, "COMPLETED");
        enrollment(uuid7(0xb12), organizationA, invited, membershipA, "INVITED");
        enrollment(uuid7(0xb13), organizationB, withdrawn, membershipB, "WITHDRAWN");
        enrollment(uuid7(0xb14), organizationA, anotherPersons, otherMembership, "ACTIVE");
        accessToken = token("cognito-" + collaborator);
    }

    @Test
    void listsOnlyProgramsBackedByTheAuthenticatedCollaboratorsValidEnrollments() throws Exception {
        mvc.perform(get("/api/v1/me/programs").header("Authorization", accessToken))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().exists("X-Request-ID"))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.items[*].id", containsInAnyOrder(ownActive.toString(), ownCompleted.toString())))
                .andExpect(jsonPath("$.items[?(@.id == '%s')].name".formatted(ownActive)).value("Tu historia, tu mayor diferencial"))
                .andExpect(jsonPath("$.items[?(@.id == '%s')].startDate".formatted(ownActive)).value("2026-09-01"))
                .andExpect(jsonPath("$.items[?(@.id == '%s')].endDate".formatted(ownActive)).value("2026-12-01"))
                .andExpect(jsonPath("$.items[0].participantId").doesNotExist())
                .andExpect(jsonPath("$.items[0].enrollmentId").doesNotExist());
    }

    @Test
    void paginatesDeterministicallyAcrossAuthorizedOrganizations() throws Exception {
        mvc.perform(get("/api/v1/me/programs").header("Authorization", accessToken)
                        .param("page", "0").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(ownActive.toString()))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));
        mvc.perform(get("/api/v1/me/programs").header("Authorization", accessToken)
                        .param("page", "1").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(ownCompleted.toString()))
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/v1/me/programs").header("Authorization", accessToken)
                        .param("page", "2").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void opensOwnBasicProgramAndHidesAnotherPersonsProgram() throws Exception {
        mvc.perform(get("/api/v1/me/programs/{programId}", ownActive).header("Authorization", accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ownActive.toString()))
                .andExpect(jsonPath("$.organizationId").value(organizationA.toString()))
                .andExpect(jsonPath("$.name").value("Tu historia, tu mayor diferencial"))
                .andExpect(jsonPath("$.description").value("Programa asignado"))
                .andExpect(jsonPath("$.status").value("DRAFT"));

        mvc.perform(get("/api/v1/me/programs/{programId}", anotherPersons).header("Authorization", accessToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PROGRAM_NOT_FOUND"));
    }

    @Test
    void doesNotExposeInvitedOrWithdrawnEnrollmentsThroughDirectProgramIds() throws Exception {
        mvc.perform(get("/api/v1/me/programs/{programId}", invited).header("Authorization", accessToken))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/me/programs/{programId}", withdrawn).header("Authorization", accessToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void filtersInactiveTenantsAndMembershipsWithoutCombiningAccess() throws Exception {
        jdbcTemplate.update("update rti.organizations set status='SUSPENDED' where id=?", organizationB);
        mvc.perform(get("/api/v1/me/programs").header("Authorization", accessToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(ownActive.toString()));

        jdbcTemplate.update("update rti.organization_memberships set status='REVOKED' where id=?", membershipA);
        mvc.perform(get("/api/v1/me/programs").header("Authorization", accessToken))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void ignoresRolesAndTenantClaimsFromTheToken() throws Exception {
        jdbcTemplate.update("delete from rti.membership_roles where membership_id in (?, ?)", membershipA, membershipB);
        mvc.perform(get("/api/v1/me/programs").header("Authorization", accessToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void requiresAValidAccessToken() throws Exception {
        mvc.perform(get("/api/v1/me/programs")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/me/programs/{programId}", ownActive)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(strings = {"page=-1", "size=0", "size=101", "page=2147483647&size=100"})
    void rejectsInvalidPagination(String query) throws Exception {
        mvc.perform(get("/api/v1/me/programs?" + query).header("Authorization", accessToken))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    private void addRole(UUID membership, String role) {
        jdbcTemplate.update("insert into rti.membership_roles (membership_id, role) values (?, ?)", membership, role);
    }

    private void programDetails(UUID program, String name, String description, String startDate, String endDate) {
        jdbcTemplate.update("update rti.programs set name=?, description=?, start_date=?::date, end_date=?::date where id=?",
                name, description, startDate, endDate, program);
    }

    private void enrollment(UUID id, UUID organization, UUID program, UUID membership, String status) {
        jdbcTemplate.queryForObject(
                "select set_config('app.current_organization_id', ?, true)", String.class, organization.toString());
        jdbcTemplate.update("insert into rti.enrollments "
                        + "(id, organization_id, program_id, participant_membership_id, status, created_at, updated_at, version) "
                        + "values (?, ?, ?, ?, ?, now(), now(), 0)",
                id, organization, program, membership, status);
    }

    private String token(String subject) {
        var now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(TEST_COGNITO_ISSUER).subject(subject)
                .issuedAt(now).expiresAt(now.plusSeconds(300)).claim("token_use", "access")
                .claim("client_id", TEST_COGNITO_CLIENT_ID)
                .claim("cognito:groups", List.of("SUPER_ADMIN", "CONSULTANT"))
                .claim("custom:organizationId", organizationB.toString()).build();
        return "Bearer " + encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(SignatureAlgorithm.RS256).build(), claims)).getTokenValue();
    }
}
