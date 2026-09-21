package com.reflejatuinterior;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.databind.ObjectMapper;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.security.autoconfigure.actuate.web.servlet.EndpointRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration(proxyBeanMethods = false)
class ActuatorHealthSecurityConfiguration {

    @Bean
    SecurityFilterChain applicationSecurityFilterChain(HttpSecurity http, ObjectMapper objectMapper) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions -> exceptions.accessDeniedHandler((request, response, exception) ->
                        writeSecurityError(response, objectMapper, 403, "FORBIDDEN", "Access is denied.")))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(EndpointRequest.to("health")).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/me", "/api/v1/me/profile").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/me/programs",
                                "/api/v1/me/programs/{programId}",
                                "/api/v1/me/programs/{programId}/activities").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/organizations").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/organizations/{organizationId}/programs").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/organizations/{organizationId}/programs",
                                "/api/v1/organizations/{organizationId}/programs/{programId}",
                                "/api/v1/organizations/{organizationId}/programs/{programId}/modules",
                                "/api/v1/organizations/{organizationId}/programs/{programId}/disc-profiles",
                                "/api/v1/organizations/{organizationId}/programs/{programId}/activities").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/organizations/{organizationId}/programs/{programId}/enrollments",
                                "/api/v1/invitations").authenticated()
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/organizations/{organizationId}/programs/{programId}/enrollments",
                                "/api/v1/organizations/{organizationId}/programs/{programId}/modules",
                                "/api/v1/organizations/{organizationId}/programs/{programId}/modules/{moduleId}/sessions",
                                "/api/v1/organizations/{organizationId}/programs/{programId}/activities",
                                "/api/v1/organizations/{organizationId}/programs/{programId}/activities/{activityId}/assignments/{assignmentId}/review",
                                "/api/v1/organizations/{organizationId}/programs/{programId}/enrollments/{enrollmentId}/invitation-delivery",
                                "/api/v1/invitations/{invitationId}/accept",
                                "/api/v1/me/programs/{programId}/activities/{activityId}/submission").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/v1/me/profile",
                                "/api/v1/organizations/{organizationId}/programs/{programId}/disc-profiles/{enrollmentId}")
                                .authenticated()
                        .anyRequest().denyAll())
                .oauth2ResourceServer(resourceServer ->
                        resourceServer.jwt(Customizer.withDefaults())
                                .authenticationEntryPoint((request, response, exception) -> {
                                    // Keep JWT decoder details out of the public challenge (RTI-VS1-006).
                                    response.setHeader(HttpHeaders.WWW_AUTHENTICATE,
                                            exception instanceof OAuth2AuthenticationException
                                                    ? "Bearer error=\"invalid_token\""
                                                    : "Bearer");
                                    writeSecurityError(response, objectMapper, 401, "UNAUTHENTICATED",
                                            "Authentication is required or the access token is invalid.");
                                })
                                .accessDeniedHandler((request, response, exception) ->
                                        writeSecurityError(response, objectMapper, 403,
                                                "FORBIDDEN", "Access is denied.")))
                .build();
    }

    private static void writeSecurityError(
            HttpServletResponse response, ObjectMapper objectMapper, int status,
            String code, String message) throws IOException {
        String requestId = UUID.randomUUID().toString();
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("X-Request-ID", requestId);
        objectMapper.writeValue(response.getOutputStream(), Map.of(
                "code", code, "message", message, "requestId", requestId));
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${app.security.cors.allowed-origins}") String allowedOrigins) {
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();

        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(List.of(HttpMethod.GET.name(), HttpMethod.POST.name(), HttpMethod.PUT.name(),
                HttpMethod.OPTIONS.name()));
        configuration.setAllowedHeaders(List.of(HttpHeaders.AUTHORIZATION, HttpHeaders.CONTENT_TYPE));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
}
