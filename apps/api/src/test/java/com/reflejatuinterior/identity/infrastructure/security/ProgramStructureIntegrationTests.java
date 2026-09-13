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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
class ProgramStructureIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID organization = uuid7(0xa01), other = uuid7(0xa02), user = uuid7(0xa03), membership = uuid7(0xa04);
    private final UUID program = uuid7(0xa05), foreignProgram = uuid7(0xa06);
    @Autowired MockMvc mvc;
    @Autowired JwtEncoder encoder;
    @Autowired ObjectMapper json;
    @Autowired OrganizationTenantContext tenantContext;
    private String bearer;

    @BeforeEach void setup() {
        insertOrganization(organization); insertOrganization(other); insertUser(user);
        insertMembership(membership, organization, user); role("CONSULTANT");
        insertProgram(program, organization); insertProgram(foreignProgram, other);
        bearer = token("cognito-" + user);
    }

    @Test void createsAndListsAnOrderedModuleWithItsDatedSession() throws Exception {
        var moduleResponse = mvc.perform(post(path(organization, program)).header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(moduleBody(1)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("Fundamentos"))
                .andExpect(jsonPath("$.position").value(1)).andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.sessions").isEmpty()).andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse();
        var moduleId = UUID.fromString(json.readTree(moduleResponse.getContentAsString()).path("id").asText());
        assertThat(moduleId.version()).isEqualTo(7);

        var sessionResponse = mvc.perform(post(path(organization, program) + "/" + moduleId + "/sessions")
                .header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content(sessionBody(1)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.moduleId").value(moduleId.toString()))
                .andExpect(jsonPath("$.scheduledDate").value("2026-10-01")).andExpect(jsonPath("$.position").value(1))
                .andReturn().getResponse();
        var sessionId = UUID.fromString(json.readTree(sessionResponse.getContentAsString()).path("id").asText());
        assertThat(sessionId.version()).isEqualTo(7);

        mvc.perform(get(path(organization, program)).header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(moduleId.toString()))
                .andExpect(jsonPath("$.items[0].sessions.length()").value(1))
                .andExpect(jsonPath("$.items[0].sessions[0].id").value(sessionId.toString()));
        tenantContext.activate(organization);
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.program_modules where organization_id=?", Long.class, organization)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.program_sessions where organization_id=?", Long.class, organization)).isEqualTo(1);
    }

    @Test void rejectsUnknownAndCrossTenantParentsWithoutLeakingTheirExistence() throws Exception {
        for (String target : new String[]{path(organization, foreignProgram), path(other, foreignProgram),
                path(organization, uuid7(0xaff))}) {
            mvc.perform(get(target).header("Authorization", bearer)).andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("PROGRAM_NOT_FOUND"));
            mvc.perform(post(target).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                    .content(moduleBody(1))).andExpect(status().isNotFound());
        }
        mvc.perform(post(path(organization, program) + "/" + uuid7(0xafe) + "/sessions")
                .header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content(sessionBody(1)))
                .andExpect(status().isNotFound());
    }

    @ParameterizedTest @ValueSource(strings = {"COMPANY_ADMIN", "LEADER", "COLLABORATOR", "SUPER_ADMIN", ""})
    void onlyConsultantsCanReadOrCreateProgramStructure(String role) throws Exception {
        role(role);
        mvc.perform(get(path(organization, program)).header("Authorization", bearer)).andExpect(status().isForbidden());
        mvc.perform(post(path(organization, program)).header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(moduleBody(1))).andExpect(status().isForbidden());
    }

    @Test void rejectsInvalidInputAndDuplicateSiblingPositions() throws Exception {
        mvc.perform(post(path(organization, program)).header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" \",\"position\":0}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(post(path(organization, program)).header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(moduleBody(1))).andExpect(status().isCreated());
        mvc.perform(post(path(organization, program)).header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON).content(moduleBody(1)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_STRUCTURE_CONFLICT"));
    }

    @Test void requiresAuthentication() throws Exception {
        mvc.perform(get(path(organization, program))).andExpect(status().isUnauthorized());
        mvc.perform(post(path(organization, program)).contentType(MediaType.APPLICATION_JSON).content(moduleBody(1)))
                .andExpect(status().isUnauthorized());
    }

    private void role(String value) {
        jdbcTemplate.update("delete from rti.membership_roles where membership_id=?", membership);
        if (!value.isEmpty()) jdbcTemplate.update("insert into rti.membership_roles values (?, ?)", membership, value);
    }
    private String path(UUID org, UUID programId) {
        return "/api/v1/organizations/" + org + "/programs/" + programId + "/modules";
    }
    private String moduleBody(int position) {
        return "{\"name\":\" Fundamentos \",\"description\":\"Contexto\",\"position\":" + position + "}";
    }
    private String sessionBody(int position) {
        return "{\"name\":\" Sesión inicial \",\"description\":\"Encuentro\",\"scheduledDate\":\"2026-10-01\",\"position\":" + position + "}";
    }
    private String token(String subject) {
        var now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(TEST_COGNITO_ISSUER).subject(subject).issuedAt(now).expiresAt(now.plusSeconds(300))
                .claim("token_use", "access").claim("client_id", TEST_COGNITO_CLIENT_ID).build();
        return "Bearer " + encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(SignatureAlgorithm.RS256).build(), claims)).getTokenValue();
    }
}
