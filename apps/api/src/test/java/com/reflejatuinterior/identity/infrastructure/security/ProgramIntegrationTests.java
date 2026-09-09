package com.reflejatuinterior.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.time.Instant;
import java.util.UUID;
import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@AutoConfigureMockMvc
@Import(CognitoAuthenticationIntegrationTests.JwtTestConfiguration.class)
@Transactional
class ProgramIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID organization = uuid7(0x901), other = uuid7(0x902), user = uuid7(0x903), membership = uuid7(0x904);
    private final UUID program = uuid7(0x905), foreignProgram = uuid7(0x906);
    @Autowired MockMvc mvc;
    @Autowired JwtEncoder encoder;
    @Autowired ObjectMapper json;
    private String bearer;

    @BeforeEach void setup() {
        insertOrganization(organization); insertOrganization(other); insertUser(user); insertMembership(membership, organization, user);
        role("CONSULTANT"); insertProgram(program, organization); insertProgram(foreignProgram, other);
        bearer = token("cognito-" + user);
    }

    @Test void createsDraftWithUuid7DatesVersionAndReadback() throws Exception {
        var response = create(organization, valid()).andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("Programa"))
                .andExpect(jsonPath("$.status").value("DRAFT")).andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.organizationId").value(organization.toString())).andExpect(jsonPath("$.startDate").value("2026-09-01"))
                .andExpect(jsonPath("$.endDate").value("2026-12-01")).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().exists("X-Request-ID")).andReturn().getResponse();
        var id = UUID.fromString(json.readTree(response.getContentAsString()).path("id").asText());
        assertThat(id.version()).isEqualTo(7);
        assertThat(response.getHeader("Location")).isEqualTo(path(organization) + "/" + id);
        assertThat(jdbcTemplate.queryForObject("select status from rti.programs where id=? and organization_id=?", String.class, id, organization)).isEqualTo("DRAFT");
        assertThat(jdbcTemplate.queryForObject("select version from rti.programs where id=?", Long.class, id)).isZero();
        detail(organization, id).andExpect(status().isOk()).andExpect(jsonPath("$.description").value("Descripción"));
        list(organization).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test void cannotInjectOwnershipStatusVersionOrConsultant() throws Exception {
        String input = valid().replace("}", ",\"organizationId\":\"" + other + "\",\"id\":\"" + foreignProgram
                + "\",\"status\":\"ACTIVE\",\"version\":99,\"primaryConsultantMembershipId\":\"" + membership + "\"}");
        var response = create(organization, input).andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.version").value(0)).andExpect(jsonPath("$.organizationId").value(organization.toString())).andReturn().getResponse();
        var id = UUID.fromString(json.readTree(response.getContentAsString()).path("id").asText());
        assertThat(id).isNotEqualTo(foreignProgram);
        assertThat(jdbcTemplate.queryForObject("select primary_consultant_membership_id from rti.programs where id=?", UUID.class, id)).isNull();
    }

    @Test void crossTenantAndUnknownResourcesAreIndistinguishable() throws Exception {
        for (String target : new String[]{path(other) + "/" + foreignProgram, path(organization) + "/" + foreignProgram,
                path(organization) + "/" + uuid7(0x999), path(uuid7(0x998)) + "/" + foreignProgram}) {
            mvc.perform(get(target).header("Authorization", bearer)).andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("PROGRAM_NOT_FOUND")).andExpect(jsonPath("$.message").value("Program resource not found."));
        }
        list(other).andExpect(status().isNotFound());
        create(other, valid()).andExpect(status().isNotFound());
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.programs where organization_id=?", Long.class, other)).isEqualTo(1);
    }

    @Test void listIsPaginatedDeterministicallyWithoutOtherTenantTotals() throws Exception {
        insertProgram(uuid7(0x910), organization);
        mvc.perform(get(path(organization)).header("Authorization", bearer).param("page", "0").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].id").value(uuid7(0x910).toString()))
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.totalPages").value(2));
        mvc.perform(get(path(organization)).header("Authorization", bearer).param("page", "1").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(program.toString()));
        mvc.perform(get(path(organization)).header("Authorization", bearer).param("page", "20"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
    }

    @ParameterizedTest @ValueSource(strings = {"COMPANY_ADMIN", "LEADER"})
    void readOnlyRolesCanReadBasicMetadataButCannotCreate(String role) throws Exception {
        role(role); list(organization).andExpect(status().isOk()); detail(organization, program).andExpect(status().isOk());
        create(organization, valid()).andExpect(status().isForbidden());
    }
    @ParameterizedTest @ValueSource(strings = {"COLLABORATOR", "SUPER_ADMIN", ""})
    void noImplicitPermissionFromUnsupportedRoleOrCognitoClaims(String role) throws Exception {
        role(role); list(organization).andExpect(status().isForbidden()); detail(organization, program).andExpect(status().isForbidden());
        create(organization, valid()).andExpect(status().isForbidden());
    }
    @Test void rolesAreNotCombinedAcrossTenants() throws Exception {
        var second = uuid7(0x911); insertMembership(second, other, user);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'COMPANY_ADMIN')", second);
        create(other, valid()).andExpect(status().isForbidden());
        detail(other, foreignProgram).andExpect(status().isOk());
        detail(organization, foreignProgram).andExpect(status().isNotFound());
    }
    @ParameterizedTest @ValueSource(strings = {"REVOKED", "SUSPENDED", "PENDING"})
    void membershipRevocationTakesEffectWithSameJwt(String state) throws Exception {
        list(organization).andExpect(status().isOk());
        jdbcTemplate.update("update rti.organization_memberships set status=? where id=?", state, membership);
        list(organization).andExpect(status().isNotFound()); create(organization, valid()).andExpect(status().isNotFound());
    }
    @ParameterizedTest @ValueSource(strings = {"SUSPENDED", "DEACTIVATED"})
    void inactiveOrganizationCannotBeUsed(String state) throws Exception {
        jdbcTemplate.update("update rti.organizations set status=? where id=?", state, organization);
        detail(organization, program).andExpect(status().isNotFound()); create(organization, valid()).andExpect(status().isNotFound());
    }
    @Test void inactiveOrUnknownInternalUsersAreForbidden() throws Exception {
        bearer = token("missing"); list(organization).andExpect(status().isForbidden());
        bearer = token("cognito-" + user); jdbcTemplate.update("update rti.users set status='SUSPENDED' where id=?", user);
        create(organization, valid()).andExpect(status().isForbidden());
    }
    @Test void missingTokenIs401ForAllThreeOperations() throws Exception {
        mvc.perform(get(path(organization))).andExpect(status().isUnauthorized());
        mvc.perform(get(path(organization) + "/" + program)).andExpect(status().isUnauthorized());
        mvc.perform(post(path(organization)).contentType(MediaType.APPLICATION_JSON).content(valid())).andExpect(status().isUnauthorized());
    }
    @ParameterizedTest @ValueSource(strings = {"{}", "{", "{\"name\":\"Test\",\"startDate\":\"2026-12-01\",\"endDate\":\"2026-09-01\"}",
            "{\"name\":\"Test\",\"startDate\":\"2026-02-30\",\"endDate\":\"2026-12-01\"}",
            "{\"name\":\" \",\"startDate\":\"2026-09-01\",\"endDate\":\"2026-12-01\"}"})
    void invalidInputDoesNotWrite(String input) throws Exception {
        create(organization, input).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.programs where organization_id=?", Long.class, organization)).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(strings = {"size=0", "size=101", "page=-1", "page=invalid", "page=2147483647&size=100"})
    void rejectsInvalidPagination(String query) throws Exception {
        mvc.perform(get(path(organization) + "?" + query).header("Authorization", bearer)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }
    @Test void rejectsMalformedUuidAndUnimplementedMutation() throws Exception {
        mvc.perform(get(path(organization) + "/invalid").header("Authorization", bearer)).andExpect(status().isBadRequest());
        mvc.perform(patch(path(organization) + "/" + program).header("Authorization", bearer)).andExpect(status().isForbidden());
    }

    private void role(String value) {
        jdbcTemplate.update("delete from rti.membership_roles where membership_id=?", membership);
        if (!value.isEmpty()) jdbcTemplate.update("insert into rti.membership_roles values (?, ?)", membership, value);
    }
    private String path(UUID org) { return "/api/v1/organizations/" + org + "/programs"; }
    private ResultActions list(UUID org) throws Exception { return mvc.perform(get(path(org)).header("Authorization", bearer)); }
    private ResultActions detail(UUID org, UUID id) throws Exception { return mvc.perform(get(path(org) + "/" + id).header("Authorization", bearer)); }
    private ResultActions create(UUID org, String body) throws Exception { return mvc.perform(post(path(org)).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content(body)); }
    private String valid() { return "{\"name\":\" Programa \",\"description\":\"Descripción\",\"startDate\":\"2026-09-01\",\"endDate\":\"2026-12-01\"}"; }
    private String token(String subject) {
        var now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(TEST_COGNITO_ISSUER).subject(subject).issuedAt(now).expiresAt(now.plusSeconds(300))
                .claim("token_use", "access").claim("client_id", TEST_COGNITO_CLIENT_ID)
                .claim("cognito:groups", java.util.List.of("CONSULTANT", "SUPER_ADMIN")).claim("custom:organizationId", other.toString()).build();
        return "Bearer " + encoder.encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).build(), claims)).getTokenValue();
    }
}
