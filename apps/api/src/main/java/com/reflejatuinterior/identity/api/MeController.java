package com.reflejatuinterior.identity.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(path = "/api/v1/me", produces = MediaType.APPLICATION_JSON_VALUE)
@SecurityScheme(
        name = "cognitoAccessToken",
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT")
final class MeController {

    @GetMapping
    @Operation(
            summary = "Return the canonical external identity of the authenticated user",
            security = @SecurityRequirement(name = "cognitoAccessToken"))
    @ApiResponse(responseCode = "200", description = "Authenticated Cognito subject")
    @ApiResponse(responseCode = "401", description = "Missing or invalid access token")
    MeResponse getCurrentIdentity(@AuthenticationPrincipal Jwt jwt) {
        return new MeResponse(jwt.getSubject());
    }
}
