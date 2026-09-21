package com.reflejatuinterior.participation.api;

import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.participation.application.DiscProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@SecurityRequirement(name = "cognitoAccessToken")
@ApiResponse(responseCode = "401", description = "Missing or invalid Cognito access token")
class DiscProfileController {
    private final DiscProfileService service;
    DiscProfileController(DiscProfileService service) { this.service = service; }

    @GetMapping(path = "/api/v1/organizations/{organizationId}/programs/{programId}/disc-profiles",
            produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "List collaborator DISC records for an authorized program consultant or leader")
    ResponseEntity<ListResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
            @PathVariable UUID programId, HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(new ListResponse(service.list(jwt.getSubject(), organizationId, programId, id)));
    }

    @PutMapping(path = "/api/v1/organizations/{organizationId}/programs/{programId}/disc-profiles/{enrollmentId}",
            consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Create or update one collaborator DISC record with optimistic concurrency")
    ResponseEntity<DiscProfileService.Response> save(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID programId, @PathVariable UUID enrollmentId,
            @Valid @RequestBody SaveRequest input, HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(service.save(jwt.getSubject(), organizationId, programId, enrollmentId,
                        input.dominant(), input.influential(), input.serene(), input.conscientious(),
                        input.version(), id));
    }

    record SaveRequest(@NotBlank @Size(max = 5000) String dominant,
            @NotBlank @Size(max = 5000) String influential,
            @NotBlank @Size(max = 5000) String serene,
            @NotBlank @Size(max = 5000) String conscientious,
            @PositiveOrZero Long version) {}
    record ListResponse(List<DiscProfileService.Response> items) {
        ListResponse { items = List.copyOf(items); }
    }
}
