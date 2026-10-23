package com.reflejatuinterior.participation.api;

import java.util.UUID;
import com.reflejatuinterior.identity.CollaboratorInvitations;
import com.reflejatuinterior.participation.application.EnrollmentAdministrationService;
import com.reflejatuinterior.participation.application.EnrollmentChanges;
import com.reflejatuinterior.participation.application.EnrollmentService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@SecurityRequirement(name="cognitoAccessToken")
@RequestMapping("/api/v1/organizations/{organizationId}/programs/{programId}/enrollments/{enrollmentId}")
class EnrollmentAdministrationController {
    private final EnrollmentAdministrationService service;
    EnrollmentAdministrationController(EnrollmentAdministrationService service) { this.service=service; }
    @PostMapping("/administration")
    ResponseEntity<EnrollmentService.EnrollmentResponse> change(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID organizationId,
            @PathVariable UUID programId,@PathVariable UUID enrollmentId,@Valid @RequestBody ChangeRequest input,HttpServletRequest request) {
        var rid=EnrollmentController.requestId(request);
        var result=service.change(jwt.getSubject(),organizationId,programId,enrollmentId,input.version(),input.action(),
                input.reason(),Boolean.TRUE.equals(input.confirmed()),input.role(),input.roleVersion(),rid);
        var body=result.enrollment();
        // Renewed invitations are also drafts: only an explicit send action sends email.
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID",rid).body(body);
    }
    @GetMapping("/history")
    ResponseEntity<EnrollmentChanges.Page> history(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID organizationId,
            @PathVariable UUID programId,@PathVariable UUID enrollmentId,@RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="20") int size,HttpServletRequest request) {
        var rid=EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID",rid)
                .body(service.history(jwt.getSubject(),organizationId,programId,enrollmentId,page,size,rid));
    }
    record ChangeRequest(@NotNull @PositiveOrZero Long version,
            @NotBlank @Pattern(regexp="REVOKE|WITHDRAW|SUSPEND|COMPLETE|REINSTATE|CHANGE_ROLE") String action,
            @NotBlank @Size(max=1000) String reason,@NotNull Boolean confirmed,
            CollaboratorInvitations.InvitedRole role,@PositiveOrZero Long roleVersion) {}
}
