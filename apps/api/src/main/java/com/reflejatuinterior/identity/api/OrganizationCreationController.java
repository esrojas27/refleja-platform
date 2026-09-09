package com.reflejatuinterior.identity.api;

import java.util.UUID;
import com.reflejatuinterior.identity.application.CreateOrganization;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
class OrganizationCreationController {
    private final CreateOrganization create;

    OrganizationCreationController(CreateOrganization create) { this.create = create; }

    @PostMapping(path = "/api/v1/organizations", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Create an organization and the creator's active CONSULTANT membership",
            description = "Requires an active internal user with active CONSULTANT membership in the configured active operator organization. "
                    + "No tenant, owner, role, status or version is accepted from the client. Name: 1–255 characters; timezone: named IANA zone. "
                    + "Creation is atomic and is not automatically retried or deduplicated.",
            security = @SecurityRequirement(name = "cognitoAccessToken"))
    @ApiResponse(responseCode = "201", description = "Organization created, ACTIVE, UUIDv7, initial version 0")
    @ApiResponse(responseCode = "400", description = "Invalid name, timezone or JSON request")
    @ApiResponse(responseCode = "401", description = "Missing or invalid access token")
    @ApiResponse(responseCode = "403", description = "No active operator CONSULTANT authorization")
    @ApiResponse(responseCode = "409", description = "Persistence or concurrency conflict; no partial creation")
    @ApiResponse(responseCode = "500", description = "Unexpected failure; sanitized error with requestId")
    ResponseEntity<OrganizationResponse> create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateRequest input, HttpServletRequest request) {
        String requestId = UUID.randomUUID().toString();
        request.setAttribute("rti.requestId", requestId);
        var result = create.execute(jwt.getSubject(), input.name(), input.defaultTimeZone(), requestId);
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).header("X-Request-ID", requestId)
                .body(new OrganizationResponse(result.id(), result.name(), result.status(), result.defaultTimeZone(), result.version()));
    }

    record CreateRequest(@NotBlank @Size(max = 255) String name, @NotBlank @Size(max = 255) String defaultTimeZone) {}
    record OrganizationResponse(UUID id, String name, String status, String defaultTimeZone, long version) {}
}
