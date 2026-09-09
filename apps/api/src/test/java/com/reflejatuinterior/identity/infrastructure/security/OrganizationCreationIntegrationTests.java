package com.reflejatuinterior.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.UUID;
import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.ObjectMapper;

@AutoConfigureMockMvc
@Import(CognitoAuthenticationIntegrationTests.JwtTestConfiguration.class)
@TestPropertySource(properties = "app.security.operator-organization-id=01900000-0000-7000-8000-000000000810")
class OrganizationCreationIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID operator = uuid7(0x810);
    private final UUID user = uuid7(0x811);
    private final UUID membership = uuid7(0x812);
    private final UUID foreign = uuid7(0x813);
    private String bearer;
    @Autowired MockMvc mvc;
    @Autowired JwtEncoder encoder;
    @Autowired ObjectMapper json;

    @BeforeEach void setup() {
        clean();
        insertUser(user);
        insertOrganization(operator);
        jdbcTemplate.update("update rti.organizations set name='Refleja Tu Interior', slug='refleja-tu-interior' where id=?", operator);
        insertMembership(membership, operator, user);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'CONSULTANT')", membership);
        bearer = token("cognito-" + user);
    }

    @AfterEach void clean() {
        // This datasource is the private Testcontainers database, never the development database.
        migratorJdbcTemplate().execute("alter table rti.membership_roles drop constraint if exists test_reject_new_role");
        for (String table : new String[]{"enrollments", "programs", "membership_roles", "organization_memberships", "organizations", "users"}) {
            jdbcTemplate.update("delete from rti." + table);
        }
    }

    @Test void createsPersistedOrganizationAndCreatorAccessThenExposesItThroughMe() throws Exception {
        var response = create(valid()).andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Empresa Real"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.defaultTimeZone").value("Europe/Madrid"))
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.slug").doesNotExist())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().exists("X-Request-ID")).andReturn().getResponse();
        var body = json.readTree(response.getContentAsString());
        UUID id = UUID.fromString(body.path("id").asText());
        assertThat(id.version()).isEqualTo(7);
        assertThat(jdbcTemplate.queryForObject("select status from rti.organizations where id=?", String.class, id)).isEqualTo("ACTIVE");
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.organization_memberships m join rti.membership_roles r on r.membership_id=m.id where m.organization_id=? and m.user_id=? and m.status='ACTIVE' and r.role='CONSULTANT'", Long.class, id, user)).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject("select uuid_extract_version(id) from rti.organization_memberships where organization_id=?", Integer.class, id)).isEqualTo(7);
        mvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer).param("organizationId", id.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.activeOrganizationId").value(id.toString()))
                .andExpect(jsonPath("$.roles[0]").value("CONSULTANT"))
                .andExpect(jsonPath("$.canCreateOrganizations").value(true));
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.programs", Long.class)).isZero();
    }

    @Test void anonymousInvalidAndUnknownIdentityCannotWrite() throws Exception {
        mvc.perform(post("/api/v1/organizations").contentType(MediaType.APPLICATION_JSON).content(valid())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/organizations").header("Authorization", "Bearer invalid").contentType(MediaType.APPLICATION_JSON).content(valid())).andExpect(status().isUnauthorized());
        bearer = token("unknown");
        denied();
    }

    @ParameterizedTest @ValueSource(strings = {"INVITED", "SUSPENDED", "DEACTIVATED"})
    void inactiveUserCannotCreate(String status) throws Exception {
        jdbcTemplate.update("update rti.users set status=? where id=?", status, user);
        denied();
    }

    @ParameterizedTest @ValueSource(strings = {"PENDING", "SUSPENDED", "REVOKED"})
    void inactiveMembershipCannotCreate(String status) throws Exception {
        jdbcTemplate.update("update rti.organization_memberships set status=? where id=?", status, membership);
        denied();
    }

    @ParameterizedTest @ValueSource(strings = {"SUSPENDED", "DEACTIVATED"})
    void inactiveOperatorOrganizationCannotCreate(String status) throws Exception {
        jdbcTemplate.update("update rti.organizations set status=? where id=?", status, operator);
        denied();
    }

    @ParameterizedTest @ValueSource(strings = {"COMPANY_ADMIN", "LEADER", "COLLABORATOR", "SUPER_ADMIN"})
    void otherRolesDoNotGrantCreation(String role) throws Exception {
        jdbcTemplate.update("update rti.membership_roles set role=? where membership_id=?", role, membership);
        denied();
    }

    @Test void revokedRoleTakesEffectOnNextRequestEvenWithTheSameJwt() throws Exception {
        mvc.perform(get("/api/v1/me").header("Authorization", bearer)).andExpect(jsonPath("$.canCreateOrganizations").value(true));
        jdbcTemplate.update("delete from rti.membership_roles where membership_id=?", membership);
        denied();
        mvc.perform(get("/api/v1/me").header("Authorization", bearer)).andExpect(jsonPath("$.canCreateOrganizations").value(false));
    }

    @Test void consultantInAnImpostorOrganizationCannotCreateOrAccessTheOperatorTenant() throws Exception {
        jdbcTemplate.update("delete from rti.membership_roles");
        jdbcTemplate.update("delete from rti.organization_memberships");
        insertOrganization(foreign);
        jdbcTemplate.update("update rti.organizations set name='Refleja Tu Interior' where id=?", foreign);
        insertMembership(uuid7(0x814), foreign, user);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'CONSULTANT')", uuid7(0x814));
        create(valid()).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/me").header("Authorization", bearer).param("organizationId", operator.toString())).andExpect(status().isNotFound());
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.organizations", Long.class)).isEqualTo(2L);
    }

    @Test void anotherUserCannotSelectTheNewOrganization() throws Exception {
        var body = create(valid()).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = json.readTree(body).path("id").asText();
        var other = uuid7(0x815); insertUser(other);
        mvc.perform(get("/api/v1/me").header("Authorization", token("cognito-" + other)).param("organizationId", id))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ORGANIZATION_NOT_AVAILABLE"));
    }

    @ParameterizedTest @ValueSource(strings = {
            "{}", "{", "{\"name\":\" \",\"defaultTimeZone\":\"UTC\"}",
            "{\"name\":\"Valid\",\"defaultTimeZone\":\"Bad/Zone\"}",
            "{\"name\":null,\"defaultTimeZone\":\"UTC\"}"
    })
    void malformedOrInvalidDataIsRejectedWithoutWrites(String input) throws Exception {
        create(input).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.requestId").isNotEmpty()).andExpect(header().exists("X-Request-ID"));
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.organizations", Long.class)).isEqualTo(1L);
    }

    @Test void clientCannotChooseStatusOwnerRoleOrIdentifier() throws Exception {
        var result = create("{\"name\":\"Safe\",\"defaultTimeZone\":\"UTC\",\"id\":\"" + operator
                + "\",\"organizationId\":\"" + operator + "\",\"status\":\"SUSPENDED\",\"roles\":[\"SUPER_ADMIN\"],\"version\":99}")
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("ACTIVE")).andExpect(jsonPath("$.version").value(0)).andReturn();
        assertThat(json.readTree(result.getResponse().getContentAsString()).path("id").asText()).isNotEqualTo(operator.toString());
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.membership_roles where role<>'CONSULTANT'", Long.class)).isZero();
    }

    @Test void membershipFailureRollsBackTheOrganizationAndDoesNotExposeSql() throws Exception {
        migratorJdbcTemplate().execute("alter table rti.membership_roles add constraint test_reject_new_role check (membership_id='" + membership + "')");
        var response = create(valid()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORGANIZATION_CREATION_CONFLICT"))
                .andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("test_reject_new_role", "INSERT", "rti.", "SQLException");
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.organizations", Long.class)).isEqualTo(1L);
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.organization_memberships", Long.class)).isEqualTo(1L);
    }

    @Test void corsAllowsLocalJsonPostAndRejectsUntrustedOrigins() throws Exception {
        mvc.perform(options("/api/v1/organizations").header("Origin", "http://localhost:3000")
                .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "authorization,content-type"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"));
        mvc.perform(options("/api/v1/organizations").header("Origin", "https://untrusted.example")
                .header("Access-Control-Request-Method", "POST")).andExpect(status().isForbidden());
    }

    private void denied() throws Exception {
        create(valid()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.organizations", Long.class)).isEqualTo(1L);
    }
    private ResultActions create(String body) throws Exception {
        return mvc.perform(post("/api/v1/organizations").header(HttpHeaders.AUTHORIZATION, bearer).contentType(MediaType.APPLICATION_JSON).content(body));
    }
    private String valid() { return "{\"name\":\"  Empresa Real  \",\"defaultTimeZone\":\"Europe/Madrid\"}"; }
    private String token(String sub) {
        var now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(TEST_COGNITO_ISSUER).subject(sub).issuedAt(now).expiresAt(now.plusSeconds(300))
                .claim("token_use", "access").claim("client_id", TEST_COGNITO_CLIENT_ID)
                .claim("cognito:groups", java.util.List.of("CONSULTANT", "SUPER_ADMIN")).claim("custom:organizationId", operator.toString()).build();
        return "Bearer " + encoder.encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).build(), claims)).getTokenValue();
    }
}
