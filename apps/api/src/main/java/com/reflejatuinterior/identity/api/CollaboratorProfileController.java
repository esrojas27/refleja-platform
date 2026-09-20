package com.reflejatuinterior.identity.api;

import java.time.LocalDate;
import java.util.UUID;

import com.reflejatuinterior.identity.application.CollaboratorProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(path = "/api/v1/me/profile", produces = MediaType.APPLICATION_JSON_VALUE)
final class CollaboratorProfileController {
    private final CollaboratorProfileService profiles;

    CollaboratorProfileController(CollaboratorProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping
    @Operation(summary = "Return the authenticated collaborator profile for one organization",
            description = "Email and company are server-derived. The organization is accepted only after active membership validation.",
            security = @SecurityRequirement(name = "cognitoAccessToken"))
    @ApiResponse(responseCode = "200", description = "Pending or complete collaborator profile")
    @ApiResponse(responseCode = "403", description = "Internal user is missing or inactive")
    @ApiResponse(responseCode = "404", description = "Collaborator membership is unavailable")
    ResponseEntity<ProfileResponse> get(
            @AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "Organization UUID validated against the authenticated membership")
            @RequestParam UUID organizationId) {
        return response(ProfileResponse.from(profiles.get(jwt.getSubject(), organizationId)));
    }

    @PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Complete or update the authenticated collaborator profile",
            description = "The client cannot change email, company, membership, role or profile status.",
            security = @SecurityRequirement(name = "cognitoAccessToken"))
    @ApiResponse(responseCode = "200", description = "Profile validated and marked COMPLETE")
    @ApiResponse(responseCode = "400", description = "Profile validation failed")
    ResponseEntity<ProfileResponse> complete(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam UUID organizationId,
            @Valid @RequestBody ProfileRequest request) {
        var input = new CollaboratorProfileService.Input(request.fullName(), request.dateOfBirth(), request.phone(),
                request.city(), request.country(), request.jobTitle());
        return response(ProfileResponse.from(profiles.complete(jwt.getSubject(), organizationId, input)));
    }

    private ResponseEntity<ProfileResponse> response(ProfileResponse profile) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header("X-Request-ID", UUID.randomUUID().toString()).body(profile);
    }

    record ProfileRequest(
            @NotBlank @Size(min = 2, max = 200) String fullName,
            @NotNull @Past LocalDate dateOfBirth,
            @NotBlank @Size(min = 7, max = 32) String phone,
            @NotBlank @Size(min = 2, max = 120) String city,
            @NotBlank @Size(min = 2, max = 120) String country,
            @NotBlank @Size(min = 2, max = 160) String jobTitle) {
    }

    record ProfileResponse(UUID organizationId, String company, String email, String fullName,
                           LocalDate dateOfBirth, String phone, String city, String country,
                           String jobTitle, String status) {
        static ProfileResponse from(CollaboratorProfileService.Profile profile) {
            return new ProfileResponse(profile.organizationId(), profile.company(), profile.email(), profile.fullName(),
                    profile.dateOfBirth(), profile.phone(), profile.city(), profile.country(),
                    profile.jobTitle(), profile.status());
        }
    }
}
