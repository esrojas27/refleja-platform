package com.reflejatuinterior.participation.api;

import java.net.URI;
import java.util.UUID;
import com.reflejatuinterior.participation.application.EnrollmentService;
import com.reflejatuinterior.identity.CollaboratorInvitations.InvitedRole;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(path = "/api/v1/organizations/{organizationId}/programs/{programId}/enrollments", produces = MediaType.APPLICATION_JSON_VALUE)
@SecurityRequirement(name = "cognitoAccessToken")
@ApiResponse(responseCode = "400", description = "Invalid contact fields, JSON, UUID or pagination; VALIDATION_ERROR")
@ApiResponse(responseCode = "401", description = "Missing or invalid Cognito access token")
@ApiResponse(responseCode = "403", description = "Active CONSULTANT membership required in target organization")
@ApiResponse(responseCode = "404", description = "Missing or cross-tenant organization, program or enrollment; ENROLLMENT_NOT_FOUND")
@ApiResponse(responseCode = "409", description = "Duplicate enrollment or conflicting persisted state; ENROLLMENT_CONFLICT")
@ApiResponse(responseCode = "503", description = "Cognito/SES provisioning unavailable or not configured; INVITATION_SERVICE_UNAVAILABLE")
@ApiResponse(responseCode = "500", description = "Unexpected sanitized INTERNAL_ERROR")
class EnrollmentController {
    private final EnrollmentService service;
    EnrollmentController(EnrollmentService service) { this.service = service; }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Enroll and invite a program participant", description = "CONSULTANT only. Role may be COLLABORATOR, LEADER or COMPANY_ADMIN; omitted role defaults to COLLABORATOR. "
            + "COMPANY_ADMIN is presented as RRHH in the product. Email up to 254 and first/last name 1–100 characters. "
            + "Actual Cognito sub is resolved before the atomic internal creation. New User INVITED, membership PENDING and enrollment INVITED. "
            + "Existing active access/profile is preserved; suspended or revoked access is never restored. "
            + "Invitation expires in seven days. Email is requested after commit; 201 does not guarantee delivery. "
            + "Check invitation.deliveryStatus; SENT means accepted by provider, FAILED/PENDING can be retried explicitly. Duplicate enrollment returns 409.")
    @ApiResponse(responseCode = "201", description = "Direct enrollment DTO with participant and invitation; no passwords or Cognito identifiers")
    ResponseEntity<EnrollmentService.EnrollmentResponse> create(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID programId, @Valid @RequestBody CreateRequest input,
            HttpServletRequest request) {
        String id = requestId(request);
        var result = service.create(jwt.getSubject(), organizationId, programId, input.email(), input.firstName(), input.lastName(), input.role(), id);
        return ResponseEntity.created(URI.create("/api/v1/organizations/" + organizationId + "/programs/" + programId + "/enrollments/" + result.id()))
                .cacheControl(CacheControl.noStore()).header("X-Request-ID", id).body(result);
    }

    @GetMapping
    @Operation(summary = "List enrolled collaborators", description = "CONSULTANT only. Tenant/program-scoped totals. Page starts at 0, default size 20, maximum 100; "
            + "page*size <= 2147483647, fixed id descending order. Historical enrollments may have no invitation. No credentials are exposed.")
    @ApiResponse(responseCode = "200", description = "Page of enrolled collaborators, statuses and invitation delivery state")
    ResponseEntity<EnrollmentService.EnrollmentPage> list(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID programId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        String id = requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(service.list(jwt.getSubject(), organizationId, programId, page, size, id));
    }

    @PostMapping("/{enrollmentId}/invitation-delivery")
    @Operation(summary = "Retry an invitation delivery", description = "Explicit CONSULTANT action on an INVITED enrollment. "
            + "No duplicate enrollment, no renewal of seven-day expiry, no reset of confirmed Cognito accounts. "
            + "SENT is not resent; concurrent sending uses a five-minute lease. Provider timeouts may cause duplicate email on retry, never duplicate enrollment.")
    @ApiResponse(responseCode = "200", description = "Current enrollment and delivery state; sending can remain FAILED or PENDING")
    ResponseEntity<EnrollmentService.EnrollmentResponse> retry(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID programId, @PathVariable UUID enrollmentId, HttpServletRequest request) {
        String id = requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(service.retryDelivery(jwt.getSubject(), organizationId, programId, enrollmentId, id));
    }

    static String requestId(HttpServletRequest request) {
        String id = UUID.randomUUID().toString(); request.setAttribute("rti.requestId", id); return id;
    }

    record CreateRequest(@NotBlank @Email @Size(max = 254) String email,
                         @NotBlank @Size(max = 100) String firstName, @NotBlank @Size(max = 100) String lastName,
                         InvitedRole role) {}
}
