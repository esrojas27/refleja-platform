package com.reflejatuinterior.participation.api;

import java.util.UUID;
import com.reflejatuinterior.participation.application.EnrollmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(path = "/api/v1/invitations", produces = MediaType.APPLICATION_JSON_VALUE)
@SecurityRequirement(name = "cognitoAccessToken")
@ApiResponse(responseCode = "400", description = "Invalid UUID or pagination; VALIDATION_ERROR")
@ApiResponse(responseCode = "401", description = "Missing or invalid Cognito access token")
@ApiResponse(responseCode = "403", description = "Internal user, membership or organization disabled; FORBIDDEN")
@ApiResponse(responseCode = "404", description = "Invitation missing or belonging to another Cognito subject; ENROLLMENT_NOT_FOUND")
@ApiResponse(responseCode = "409", description = "Conflicting or withdrawn state; ENROLLMENT_CONFLICT")
@ApiResponse(responseCode = "500", description = "Unexpected sanitized INTERNAL_ERROR")
class InvitationController {
    private final EnrollmentService service;
    InvitationController(EnrollmentService service) { this.service = service; }

    @GetMapping
    @Operation(summary = "List only the authenticated user's invitations", description = "Ownership is resolved from the validated Access Token sub, not email or client IDs. "
            + "INVITED and ACTIVE internal users may read their invitations. This GET never activates access. "
            + "Page starts at 0, default size 20, maximum 100, fixed id descending order; expiry is evaluated server-side.")
    @ApiResponse(responseCode = "200", description = "Page of own invitations with organization/program names and effective status")
    ResponseEntity<EnrollmentService.InvitationPage> list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        String id = EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(service.invitations(jwt.getSubject(), page, size));
    }

    @PostMapping("/{invitationId}/accept")
    @Operation(summary = "Explicitly accept an owned invitation", description = "Requires valid Cognito authentication matching the invited user sub and an unexpired PENDING invitation. "
            + "Atomically activates only INVITED User, PENDING membership and INVITED enrollment; preserves existing roles and adds COLLABORATOR. "
            + "No automatic reactivation of suspended/revoked access. Repeating accepted invitation is idempotent while access remains enabled. No program progress is created.")
    @ApiResponse(responseCode = "200", description = "Invitation ACCEPTED and enrollment ACTIVE")
    @ApiResponse(responseCode = "410", description = "Seven-day invitation expired; INVITATION_EXPIRED")
    ResponseEntity<EnrollmentService.AcceptanceResponse> accept(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID invitationId, HttpServletRequest request) {
        String id = EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(service.accept(jwt.getSubject(), invitationId, id));
    }
}
