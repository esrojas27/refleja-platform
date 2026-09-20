package com.reflejatuinterior.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
class CollaboratorProfileIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID userId = uuid7(960);
    private final UUID organizationId = uuid7(961);
    private final UUID membershipId = uuid7(962);

    @Autowired MockMvc mockMvc;
    @Autowired JwtEncoder jwtEncoder;

    private String bearer;

    @BeforeEach
    void setupProfile() {
        insertUser(userId);
        jdbcTemplate.update("update rti.users set first_name = 'Ana', last_name = 'Prueba' where id = ?", userId);
        insertOrganization(organizationId);
        insertMembership(membershipId, organizationId, userId);
        jdbcTemplate.update("update rti.organization_memberships set profile_status = 'PENDING' where id = ?", membershipId);
        jdbcTemplate.update("insert into rti.membership_roles (membership_id, role) values (?, 'COLLABORATOR')", membershipId);
        bearer = bearerFor("cognito-" + userId);
    }

    @Test
    void pendingProfileDerivesImmutableEmailAndCompany() throws Exception {
        mockMvc.perform(get("/api/v1/me/profile").param("organizationId", organizationId.toString())
                        .header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.organizationId").value(organizationId.toString()))
                .andExpect(jsonPath("$.company").value("Organization " + organizationId))
                .andExpect(jsonPath("$.email").value(userId + "@example.test"))
                .andExpect(jsonPath("$.fullName").value("Ana Prueba"))
                .andExpect(jsonPath("$.status").value("PENDING"));

        mockMvc.perform(get("/api/v1/me/programs").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isForbidden());
    }

    @Test
    void collaboratorCompletesProfileAndUnlocksSelfServiceAccess() throws Exception {
        String body = """
                {"fullName":" Ana María Prueba ","dateOfBirth":"1990-05-12","phone":"+57 300 123 4567",
                 "city":" Bogotá ","country":" Colombia ","jobTitle":" Líder de producto "}
                """;
        mockMvc.perform(put("/api/v1/me/profile").param("organizationId", organizationId.toString())
                        .header(HttpHeaders.AUTHORIZATION, bearer).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETE"))
                .andExpect(jsonPath("$.fullName").value("Ana María Prueba"))
                .andExpect(jsonPath("$.email").value(userId + "@example.test"))
                .andExpect(jsonPath("$.company").value("Organization " + organizationId))
                .andExpect(jsonPath("$.jobTitle").value("Líder de producto"));

        assertThat(jdbcTemplate.queryForObject("select profile_status from rti.organization_memberships where id = ?",
                String.class, membershipId)).isEqualTo("COMPLETE");
        assertThat(jdbcTemplate.queryForObject("select full_name from rti.users where id = ?", String.class, userId))
                .isEqualTo("Ana María Prueba");
        mockMvc.perform(get("/api/v1/me").param("organizationId", organizationId.toString())
                        .header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizations[0].profileStatus").value("COMPLETE"));
        mockMvc.perform(get("/api/v1/me/programs").header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk());
    }

    @Test
    void invalidOrUnownedProfilesNeverModifyPersistedState() throws Exception {
        String invalid = """
                {"fullName":"A","dateOfBirth":"%s","phone":"abc","city":"B","country":"C","jobTitle":"D"}
                """.formatted(LocalDate.now().plusDays(1));
        mockMvc.perform(put("/api/v1/me/profile").param("organizationId", organizationId.toString())
                        .header(HttpHeaders.AUTHORIZATION, bearer).contentType(MediaType.APPLICATION_JSON).content(invalid))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        mockMvc.perform(get("/api/v1/me/profile").param("organizationId", uuid7(999).toString())
                        .header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isNotFound());
        assertThat(jdbcTemplate.queryForObject("select profile_status from rti.organization_memberships where id = ?",
                String.class, membershipId)).isEqualTo("PENDING");
    }

    private String bearerFor(String subject) {
        Instant now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(TEST_COGNITO_ISSUER).subject(subject)
                .issuedAt(now).expiresAt(now.plusSeconds(300))
                .claim("token_use", "access").claim("client_id", TEST_COGNITO_CLIENT_ID).build();
        return "Bearer " + jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(SignatureAlgorithm.RS256).build(), claims)).getTokenValue();
    }
}
