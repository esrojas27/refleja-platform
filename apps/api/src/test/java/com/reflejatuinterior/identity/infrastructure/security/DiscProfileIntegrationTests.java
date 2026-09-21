package com.reflejatuinterior.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

@AutoConfigureMockMvc
@Import(CognitoAuthenticationIntegrationTests.JwtTestConfiguration.class)
@Transactional
class DiscProfileIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID organization = uuid7(0xe01), program = uuid7(0xe02);
    private final UUID consultant = uuid7(0xe03), consultantMembership = uuid7(0xe04);
    private final UUID leader = uuid7(0xe05), leaderMembership = uuid7(0xe06), leaderEnrollment = uuid7(0xe07);
    private final UUID collaborator = uuid7(0xe08), collaboratorMembership = uuid7(0xe09), enrollment = uuid7(0xe0a);
    private final UUID hr = uuid7(0xe0b), hrMembership = uuid7(0xe0c);
    private final UUID leaderInvitation = uuid7(0xe0d), collaboratorInvitation = uuid7(0xe0e);

    @Autowired MockMvc mvc;
    @Autowired JwtEncoder encoder;
    @Autowired OrganizationTenantContext tenantContext;

    @BeforeEach void setup() {
        insertOrganization(organization);
        insertUser(consultant); insertUser(leader); insertUser(collaborator); insertUser(hr);
        insertMembership(consultantMembership, organization, consultant);
        insertMembership(leaderMembership, organization, leader);
        insertMembership(collaboratorMembership, organization, collaborator);
        insertMembership(hrMembership, organization, hr);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'CONSULTANT')", consultantMembership);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'LEADER')", leaderMembership);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'COLLABORATOR')", collaboratorMembership);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'COMPANY_ADMIN')", hrMembership);
        insertProgram(program, organization);
        tenantContext.activate(organization);
        insertInvitation(leaderInvitation, leader, leaderMembership, "LEADER");
        insertInvitation(collaboratorInvitation, collaborator, collaboratorMembership, "COLLABORATOR");
        jdbcTemplate.update("""
                insert into rti.enrollments
                    (id, organization_id, program_id, participant_membership_id, invitation_id, status,
                     created_at, updated_at, version)
                values (?, ?, ?, ?, ?, 'ACTIVE', now(), now(), 0),
                       (?, ?, ?, ?, ?, 'ACTIVE', now(), now(), 0)
                """, leaderEnrollment, organization, program, leaderMembership, leaderInvitation,
                enrollment, organization, program, collaboratorMembership, collaboratorInvitation);
    }

    @Test void consultantAndEnrolledLeaderCanManageOnlyCollaboratorDiscWithDurableAudit() throws Exception {
        mvc.perform(get(path()).header("Authorization", token(consultant)))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].enrollmentId").value(enrollment.toString()))
                .andExpect(jsonPath("$.items[0].profile").doesNotExist());

        mvc.perform(get(path()).header("Authorization", token(leader)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));

        mvc.perform(put(path() + "/" + enrollment).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(body(null, "Decide")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.profile.dominant").value("Decide"))
                .andExpect(jsonPath("$.profile.version").value(0));

        mvc.perform(put(path() + "/" + enrollment).header("Authorization", token(leader))
                .contentType(MediaType.APPLICATION_JSON).content(body(0L, "Decide con claridad")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.profile.dominant").value("Decide con claridad"))
                .andExpect(jsonPath("$.profile.version").value(1));

        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from rti.program_participant_disc_profile_revisions where enrollment_id=?",
                Long.class, enrollment)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject(
                "select updated_by from rti.program_participant_disc_profiles where enrollment_id=?",
                UUID.class, enrollment)).isEqualTo(leader);
    }

    @Test void rejectsUnauthorizedRolesStaleUpdatesAndInvalidFields() throws Exception {
        mvc.perform(get(path()).header("Authorization", token(hr))).andExpect(status().isForbidden());
        mvc.perform(get(path()).header("Authorization", token(collaborator))).andExpect(status().isForbidden());

        mvc.perform(put(path() + "/" + enrollment).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(body(null, "Decide")))
                .andExpect(status().isOk());
        mvc.perform(put(path() + "/" + enrollment).header("Authorization", token(leader))
                .contentType(MediaType.APPLICATION_JSON).content(body(7L, "Cambio")))
                .andExpect(status().isConflict());
        mvc.perform(put(path() + "/" + enrollment).header("Authorization", token(consultant))
                .contentType(MediaType.APPLICATION_JSON).content(body(null, " ")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("dominant"));
    }

    private void insertInvitation(UUID id, UUID userId, UUID membershipId, String role) {
        jdbcTemplate.update("""
                insert into rti.user_invitations
                    (id, organization_id, user_id, membership_id, invited_by, cognito_username,
                     invited_role, status, expires_at, accepted_at, delivery_status,
                     created_at, updated_at, version)
                values (?, ?, ?, ?, ?, ?, ?, 'ACCEPTED', now() + interval '7 days', now(), 'SENT', now(), now(), 0)
                """, id, organization, userId, membershipId, consultant, "cognito-" + userId, role);
    }

    private String path() {
        return "/api/v1/organizations/" + organization + "/programs/" + program + "/disc-profiles";
    }

    private String body(Long version, String dominant) {
        return "{\"dominant\":\"" + dominant + "\",\"influential\":\"Conecta\"," +
                "\"serene\":\"Acompaña\",\"conscientious\":\"Analiza\",\"version\":" +
                (version == null ? "null" : version) + "}";
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
