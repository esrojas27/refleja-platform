package com.reflejatuinterior.identity.api;

import java.util.UUID;

import com.reflejatuinterior.identity.application.IdentityContextService;
import com.reflejatuinterior.identity.application.OrganizationCreationPolicy;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import org.springframework.http.MediaType;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(path = "/api/v1/me", produces = MediaType.APPLICATION_JSON_VALUE)
@SecurityScheme(
        name = "cognitoAccessToken",
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT")
final class MeController {
    private final IdentityContextService identityContext;
    private final OrganizationCreationPolicy creationPolicy;

    MeController(IdentityContextService identityContext, OrganizationCreationPolicy creationPolicy) {
        this.identityContext = identityContext;
        this.creationPolicy = creationPolicy;
    }

    @GetMapping
    @Operation(
            summary = "Return the internal user and available organization context",
            description = "Only active internal users are admitted. A single available organization is selected "
                    + "automatically. With multiple organizations and no selection, activeOrganizationId is null "
                    + "and roles is empty. Selection is validated on every request and is not persisted.",
            security = @SecurityRequirement(name = "cognitoAccessToken"))
    @ApiResponse(responseCode = "200", description = "Internal user, available organizations and selected context")
    @ApiResponse(responseCode = "401", description = "Missing or invalid access token")
    @ApiResponse(responseCode = "403", description = "Internal user is missing or inactive")
    @ApiResponse(responseCode = "404", description = "Requested organization is not available")
    @ApiResponse(responseCode = "400", description = "Invalid organization identifier")
    ResponseEntity<MeResponse> getCurrentIdentity(
            @AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "Optional organization UUID; never trusted without active membership")
            @RequestParam(required = false) UUID organizationId) {
        var principal = identityContext.resolve(jwt.getSubject(), organizationId);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header("X-Request-ID", UUID.randomUUID().toString())
                .body(MeResponse.from(principal, creationPolicy.allows(principal)));
    }
}
