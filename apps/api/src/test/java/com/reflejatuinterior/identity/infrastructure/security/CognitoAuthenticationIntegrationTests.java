package com.reflejatuinterior.identity.infrastructure.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.proc.SecurityContext;
import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@AutoConfigureMockMvc
@Transactional
@Import(CognitoAuthenticationIntegrationTests.JwtTestConfiguration.class)
class CognitoAuthenticationIntegrationTests extends PostgreSqlIntegrationTestSupport {

    private static final KeyPair KEY_PAIR = createKeyPair();

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JwtEncoder jwtEncoder;

    @Test
    void rejectsAMissingAccessToken() throws Exception {
        mockMvc.perform(get("/api/v1/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer"))
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    @Test
    void rejectsAMalformedAccessToken() throws Exception {
        mockMvc.perform(get("/api/v1/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer error=\"invalid_token\""))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.message").value("Authentication is required or the access token is invalid."))
                .andExpect(jsonPath("$.requestId").isNotEmpty())
                .andExpect(result -> {
                    String requestId = result.getResponse().getHeader("X-Request-ID");
                    org.junit.jupiter.api.Assertions.assertNotNull(requestId);
                    java.util.UUID.fromString(requestId);
                    org.junit.jupiter.api.Assertions.assertTrue(
                            result.getResponse().getContentAsString().contains(requestId));
                });
    }

    @Test
    void rejectsAnExpiredAccessToken() throws Exception {
        String token = token("access", TEST_COGNITO_CLIENT_ID, "expired-subject", -600, -300);

        mockMvc.perform(get("/api/v1/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer error=\"invalid_token\""))
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.message").value("Authentication is required or the access token is invalid."));
    }

    @Test
    void rejectsAnAccessTokenFromAnotherIssuer() throws Exception {
        String token = signedToken(jwtEncoder, "https://other-issuer.example.test");
        mockMvc.perform(get("/api/v1/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsAnAccessTokenSignedWithAnotherKey() throws Exception {
        String token = signedToken(encoderFor(createKeyPair()), TEST_COGNITO_ISSUER);
        mockMvc.perform(get("/api/v1/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deniesUnlistedRoutesEvenWithAValidAccessToken() throws Exception {
        String token = token("access", TEST_COGNITO_CLIENT_ID, "known-subject", 0, 300);
        mockMvc.perform(get("/api/v1/not-enabled")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Access is denied."))
                .andExpect(jsonPath("$.requestId").isNotEmpty());
    }

    private String signedToken(JwtEncoder encoder, String issuer) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer).subject("test-subject")
                .issuedAt(now).expiresAt(now.plusSeconds(300))
                .claim("token_use", "access").claim("client_id", TEST_COGNITO_CLIENT_ID)
                .build();
        return encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(SignatureAlgorithm.RS256).build(), claims)).getTokenValue();
    }

    private static JwtEncoder encoderFor(KeyPair keyPair) {
        RSAKey rsaKey = new RSAKey.Builder((RSAPublicKey) keyPair.getPublic())
                .privateKey((RSAPrivateKey) keyPair.getPrivate())
                .keyID("test-key").build();
        return new NimbusJwtEncoder(new ImmutableJWKSet<SecurityContext>(new JWKSet(rsaKey)));
    }

    @Test
    void rejectsAnIdToken() throws Exception {
        String token = token("id", TEST_COGNITO_CLIENT_ID, "id-token-subject", 0, 300);

        mockMvc.perform(get("/api/v1/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsAnAccessTokenIssuedToAnotherClient() throws Exception {
        String token = token("access", "another-client", "other-client-subject", 0, 300);

        mockMvc.perform(get("/api/v1/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsAnAccessTokenWithoutACanonicalSubject() throws Exception {
        String token = token("access", TEST_COGNITO_CLIENT_ID, null, 0, 300);

        mockMvc.perform(get("/api/v1/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void returnsTheCanonicalCognitoSubjectAndTheInternalUserForAValidAccessToken() throws Exception {
        var userId = uuid7(700);
        insertUser(userId);
        jdbcTemplate.update("update rti.users set cognito_subject = ? where id = ?", "cognito-subject-123", userId);
        String token = token("access", TEST_COGNITO_CLIENT_ID, "cognito-subject-123", 0, 300);

        mockMvc.perform(get("/api/v1/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.cognitoSubject").value("cognito-subject-123"))
                .andExpect(jsonPath("$.user.id").value(userId.toString()))
                .andExpect(jsonPath("$.organizations").isEmpty())
                .andExpect(jsonPath("$.roles").isEmpty())
                .andExpect(jsonPath("$.activeOrganizationId").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void keepsTheHealthEndpointPublic() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    private String token(
            String tokenUse,
            String clientId,
            String subject,
            long issuedAtOffsetSeconds,
            long expiresAtOffsetSeconds) {
        Instant now = Instant.now();
        JwtClaimsSet.Builder claimsBuilder = JwtClaimsSet.builder()
                .issuer(TEST_COGNITO_ISSUER)
                .issuedAt(now.plusSeconds(issuedAtOffsetSeconds))
                .expiresAt(now.plusSeconds(expiresAtOffsetSeconds))
                .claim("token_use", tokenUse)
                .claim("client_id", clientId);
        if (subject != null) {
            claimsBuilder.subject(subject);
        }
        JwtClaimsSet claims = claimsBuilder.build();
        JwsHeader headers = JwsHeader.with(SignatureAlgorithm.RS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(headers, claims)).getTokenValue();
    }

    private static KeyPair createKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (Exception exception) {
            throw new IllegalStateException("Could not create the test RSA key", exception);
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class JwtTestConfiguration {

        @Bean
        @Primary
        JwtDecoder testJwtDecoder() {
            NimbusJwtDecoder decoder = NimbusJwtDecoder
                    .withPublicKey((RSAPublicKey) KEY_PAIR.getPublic())
                    .signatureAlgorithm(SignatureAlgorithm.RS256)
                    .build();
            decoder.setJwtValidator(CognitoJwtConfiguration.createValidator(
                    TEST_COGNITO_ISSUER,
                    TEST_COGNITO_CLIENT_ID));
            return decoder;
        }

        @Bean
        JwtEncoder testJwtEncoder() {
            RSAKey rsaKey = new RSAKey.Builder((RSAPublicKey) KEY_PAIR.getPublic())
                    .privateKey((RSAPrivateKey) KEY_PAIR.getPrivate())
                    .keyID("test-key")
                    .build();
            return new NimbusJwtEncoder(
                    new ImmutableJWKSet<SecurityContext>(new JWKSet(rsaKey)));
        }
    }
}
