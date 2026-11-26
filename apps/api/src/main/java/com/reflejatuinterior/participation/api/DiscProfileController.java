package com.reflejatuinterior.participation.api;

import java.util.List;
import java.math.BigDecimal;
import java.io.IOException;
import org.springframework.web.multipart.MultipartFile;
import java.util.UUID;
import com.reflejatuinterior.participation.application.DiscProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.PositiveOrZero;

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
    @Operation(summary = "List collaborator DISC records for an authorized program consultant, leader or HR")
    ResponseEntity<ListResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
            @PathVariable UUID programId, HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(new ListResponse(service.list(jwt.getSubject(), organizationId, programId, id)));
    }

    @GetMapping(path="/api/v1/me/programs/{programId}/disc-profile", produces=MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary="Consult the authenticated collaborator's own complete DISC profile")
    ResponseEntity<DiscProfileService.OwnResponse> own(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID programId,HttpServletRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID",EnrollmentController.requestId(request))
            .body(service.own(jwt.getSubject(),programId));
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
                        input.dominant().intValueExact(), input.influential().intValueExact(), input.serene().intValueExact(), input.conscientious().intValueExact(),
                        input.version(), id));
    }

    @PostMapping(path="/api/v1/organizations/{organizationId}/programs/{programId}/disc-profiles/{enrollmentId}/pdf",
            consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary="Upload a new DISC PDF version to the participant's private program files")
    ResponseEntity<?> uploadPdf(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID organizationId,@PathVariable UUID programId,
            @PathVariable UUID enrollmentId,@RequestPart MultipartFile file,HttpServletRequest request) throws IOException {
        var id=EnrollmentController.requestId(request);
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).header("X-Request-ID",id)
            .body(service.uploadPdf(jwt.getSubject(),organizationId,programId,enrollmentId,file.getBytes(),id));
    }

    record SaveRequest(
            @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer=3,fraction=0) BigDecimal dominant,
            @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer=3,fraction=0) BigDecimal influential,
            @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer=3,fraction=0) BigDecimal serene,
            @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer=3,fraction=0) BigDecimal conscientious,
            @PositiveOrZero Long version) {}
    record ListResponse(List<DiscProfileService.Response> items) {
        ListResponse { items = List.copyOf(items); }
    }
}
