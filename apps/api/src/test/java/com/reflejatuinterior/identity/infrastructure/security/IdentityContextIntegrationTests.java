package com.reflejatuinterior.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;
import com.reflejatuinterior.identity.application.IdentityContextService;
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
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@AutoConfigureMockMvc
@Import(CognitoAuthenticationIntegrationTests.JwtTestConfiguration.class)
@Transactional
class IdentityContextIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID userId = uuid7(710);
    private final UUID organizationA = uuid7(711);
    private final UUID organizationB = uuid7(712);
    private final UUID membershipA = uuid7(713);
    private final UUID membershipB = uuid7(714);
    private String bearer;

    @Autowired MockMvc mockMvc;
    @Autowired JwtEncoder jwtEncoder;
    @Autowired IdentityContextService contexts;

    @BeforeEach
    void createKnownUser() {
        insertUser(userId);
        jdbcTemplate.update("update rti.users set first_name = 'Test', last_name = 'User' where id = ?", userId);
        bearer = bearerFor("cognito-" + userId);
    }

    @Test
    void knownUserWithoutMembershipsHasAnEmptyContext() throws Exception {
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.user.id").value(userId.toString()))
                .andExpect(jsonPath("$.user.firstName").value("Test"))
                .andExpect(jsonPath("$.user.email").value(userId + "@example.test"))
                .andExpect(jsonPath("$.organizations").isEmpty())
                .andExpect(jsonPath("$.activeOrganizationId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.roles").isEmpty());
    }

    @Test
    void unknownSubjectIsDeniedAndNeverProvisionedOrMatchedByEmail() throws Exception {
        Long before = jdbcTemplate.queryForObject("select count(*) from rti.users", Long.class);
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearerFor("unknown-subject")))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Internal access is not available."))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.users", Long.class)).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {"INVITED", "SUSPENDED", "DEACTIVATED"})
    void nonActiveUsersCannotObtainAnInternalContext(String userStatus) throws Exception {
        addMembership(organizationA, membershipA, "ACTIVE", "CONSULTANT");
        jdbcTemplate.update("update rti.users set status = ? where id = ?", userStatus, userId);
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        assertThat(jdbcTemplate.queryForObject("select status from rti.users where id = ?", String.class, userId))
                .isEqualTo(userStatus);
    }

    @Test
    void singleActiveMembershipIsSelectedAndPreservesMultipleDatabaseRoles() throws Exception {
        addMembership(organizationA, membershipA, "ACTIVE", "LEADER", "COLLABORATOR");
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeOrganizationId").value(organizationA.toString()))
                .andExpect(jsonPath("$.organizations[0].name").value("Organization " + organizationA))
                .andExpect(jsonPath("$.roles", org.hamcrest.Matchers.containsInAnyOrder("LEADER", "COLLABORATOR")));
        assertThat(contexts.resolve("cognito-" + userId, null).hasRole(organizationA, "LEADER")).isTrue();
        assertThat(contexts.resolve("cognito-" + userId, null).hasRole(organizationB, "LEADER")).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING", "SUSPENDED", "REVOKED"})
    void nonActiveMembershipsAreExcludedAndCannotBeSelected(String membershipStatus) throws Exception {
        addMembership(organizationA, membershipA, membershipStatus, "SUPER_ADMIN");
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.organizations").isEmpty())
                .andExpect(jsonPath("$.roles").isEmpty());
        unavailable(organizationA);
    }

    @ParameterizedTest
    @ValueSource(strings = {"SUSPENDED", "DEACTIVATED"})
    void nonOperationalOrganizationsCannotProvideAnActiveContext(String organizationStatus) throws Exception {
        addMembership(organizationA, membershipA, "ACTIVE", "CONSULTANT");
        jdbcTemplate.update("update rti.organizations set status = ? where id = ?", organizationStatus, organizationA);
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.organizations").isEmpty());
        unavailable(organizationA);
    }

    @Test
    void multipleOrganizationsRequireSelectionAndNeverUnionRoles() throws Exception {
        addMembership(organizationA, membershipA, "ACTIVE", "COLLABORATOR");
        addMembership(organizationB, membershipB, "ACTIVE", "CONSULTANT");
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.organizations.length()").value(2))
                .andExpect(jsonPath("$.activeOrganizationId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.roles").isEmpty());
        mockMvc.perform(get("/api/v1/me").param("organizationId", organizationA.toString())
                        .header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.activeOrganizationId").value(organizationA.toString()))
                .andExpect(jsonPath("$.roles", org.hamcrest.Matchers.contains("COLLABORATOR")));
        mockMvc.perform(get("/api/v1/me").param("organizationId", organizationB.toString())
                        .header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.roles", org.hamcrest.Matchers.contains("CONSULTANT")));
        var context = contexts.resolve("cognito-" + userId, organizationA);
        assertThat(context.hasRole(organizationA, "CONSULTANT")).isFalse();
        assertThat(context.hasRole(organizationB, "CONSULTANT")).isFalse();
        assertThat(contexts.resolve("cognito-" + userId, null).activeOrganizationId()).isNull();
    }

    @Test
    void membershipAndRoleChangesTakeEffectOnTheNextRequest() throws Exception {
        addMembership(organizationA, membershipA, "ACTIVE", "LEADER");
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.roles", org.hamcrest.Matchers.contains("LEADER")));
        jdbcTemplate.update("delete from rti.membership_roles where membership_id = ?", membershipA);
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.roles").isEmpty());
        jdbcTemplate.update("update rti.organization_memberships set status = 'REVOKED' where id = ?", membershipA);
        unavailable(organizationA);
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.organizations").isEmpty());
    }

    @Test
    void anotherUsersOrganizationAndAnUnknownOrganizationHaveTheSameDenial() throws Exception {
        UUID otherUser = uuid7(715);
        insertUser(otherUser);
        insertOrganization(organizationB);
        insertMembership(membershipB, organizationB, otherUser);
        unavailable(organizationB);
        unavailable(uuid7(799));
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.organizations").isEmpty());
    }

    @Test
    void invalidOrganizationIdentifierHasAGenericValidationError() throws Exception {
        mockMvc.perform(get("/api/v1/me").param("organizationId", "not-a-uuid")
                        .header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    private void unavailable(UUID organizationId) throws Exception {
        mockMvc.perform(get("/api/v1/me").param("organizationId", organizationId.toString())
                        .header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isNotFound()).andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.code").value("ORGANIZATION_NOT_AVAILABLE"))
                .andExpect(jsonPath("$.message").value("Organization is not available."))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString(organizationId.toString()))));
    }

    private void addMembership(UUID organizationId, UUID membershipId, String status, String... roles) {
        insertOrganization(organizationId);
        insertMembership(membershipId, organizationId, userId);
        jdbcTemplate.update("update rti.organization_memberships set status = ? where id = ?", status, membershipId);
        for (String role : roles) {
            jdbcTemplate.update("insert into rti.membership_roles (membership_id, role) values (?, ?)", membershipId, role);
        }
    }

    private String bearerFor(String subject) {
        Instant now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(TEST_COGNITO_ISSUER).subject(subject)
                .issuedAt(now).expiresAt(now.plusSeconds(300))
                .claim("token_use", "access").claim("client_id", TEST_COGNITO_CLIENT_ID)
                // These untrusted claims must not supply internal identity, tenant or roles.
                .claim("email", userId + "@example.test")
                .claim("cognito:groups", List.of("SUPER_ADMIN"))
                .claim("custom:organizationId", organizationB.toString()).build();
        return "Bearer " + jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(SignatureAlgorithm.RS256).build(), claims)).getTokenValue();
    }
}
