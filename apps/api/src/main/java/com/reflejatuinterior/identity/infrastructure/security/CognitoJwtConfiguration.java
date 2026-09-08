package com.reflejatuinterior.identity.infrastructure.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.util.StringUtils;

@Configuration(proxyBeanMethods = false)
public class CognitoJwtConfiguration {

    private static final OAuth2Error INVALID_TOKEN = new OAuth2Error(
            "invalid_token",
            "The access token does not contain the required Cognito claims",
            null);

    @Bean
    JwtDecoder cognitoJwtDecoder(
            @Value("${app.security.cognito.issuer-uri}") String issuerUri,
            @Value("${app.security.cognito.jwk-set-uri}") String jwkSetUri,
            @Value("${app.security.cognito.app-client-id}") String appClientId) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri)
                .jwsAlgorithm(SignatureAlgorithm.RS256)
                .build();
        decoder.setJwtValidator(createValidator(issuerUri, appClientId));
        return decoder;
    }

    public static OAuth2TokenValidator<Jwt> createValidator(
            String issuerUri,
            String appClientId) {
        OAuth2TokenValidator<Jwt> issuerAndTimestamp =
                JwtValidators.createDefaultWithIssuer(issuerUri);
        OAuth2TokenValidator<Jwt> accessToken = new JwtClaimValidator<>(
                "token_use",
                tokenUse -> "access".equals(tokenUse));
        OAuth2TokenValidator<Jwt> intendedClient = new JwtClaimValidator<>(
                "client_id",
                clientId -> appClientId.equals(clientId));
        OAuth2TokenValidator<Jwt> subject = jwt -> StringUtils.hasText(jwt.getSubject())
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(INVALID_TOKEN);

        return new DelegatingOAuth2TokenValidator<>(
                issuerAndTimestamp,
                accessToken,
                intendedClient,
                subject);
    }
}
