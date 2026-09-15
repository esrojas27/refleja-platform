package com.reflejatuinterior.participation.api;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.participation.application.ActivityService;
import com.reflejatuinterior.participation.domain.ActivityReviewDecision;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
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
class ActivityController {
    private final ActivityService service;

    ActivityController(ActivityService service) { this.service = service; }

    @GetMapping(path = "/api/v1/organizations/{organizationId}/programs/{programId}/activities",
            produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "List activities and assignments for an authorized consultant")
    ResponseEntity<ActivityListResponse> consultantActivities(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID programId, HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(new ActivityListResponse(service.listForConsultant(
                        jwt.getSubject(), organizationId, programId, id)));
    }

    @PostMapping(path = "/api/v1/organizations/{organizationId}/programs/{programId}/activities",
            consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Create an activity and atomically assign it to active program enrollments",
            description = "Assignment makes the activity immediately visible. Drafts and submissions are not part of this operation.")
    @ApiResponse(responseCode = "201", description = "Activity and all assignments created")
    ResponseEntity<ActivityService.ActivityResponse> create(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID programId,
            @Valid @RequestBody CreateActivityRequest input, HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        var result = service.create(jwt.getSubject(), organizationId, programId, input.sessionId(), input.title(),
                input.instructions(), input.youtubeUrl(), input.dueDate(), input.position(), input.assignToAll(),
                input.enrollmentIds(), id);
        var location = "/api/v1/organizations/" + organizationId + "/programs/" + programId
                + "/activities/" + result.id();
        return ResponseEntity.created(URI.create(location)).cacheControl(CacheControl.noStore())
                .header("X-Request-ID", id).body(result);
    }

    @GetMapping(path = "/api/v1/me/programs/{programId}/activities", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "List activities assigned to the authenticated collaborator in one enrolled program")
    ResponseEntity<AssignedActivityListResponse> assignedActivities(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID programId, HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(new AssignedActivityListResponse(service.listOwned(jwt.getSubject(), programId, id)));
    }

    @PostMapping(path = "/api/v1/me/programs/{programId}/activities/{activityId}/submission",
            consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Submit the authenticated collaborator's textual activity response")
    @ApiResponse(responseCode = "200", description = "Assignment moved to SUBMITTED")
    ResponseEntity<ActivityService.AssignedActivityResponse> submit(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID programId, @PathVariable UUID activityId,
            @Valid @RequestBody SubmitActivityRequest input, HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(service.submit(jwt.getSubject(), programId, activityId, input.responseText(), id));
    }

    @PostMapping(path = "/api/v1/organizations/{organizationId}/programs/{programId}/activities/{activityId}"
            + "/assignments/{assignmentId}/review",
            consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Approve a submitted activity or request changes as an authorized consultant")
    @ApiResponse(responseCode = "200", description = "Assignment moved to COMPLETED or CHANGES_REQUESTED")
    ResponseEntity<ActivityService.AssigneeResponse> review(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID programId, @PathVariable UUID activityId,
            @PathVariable UUID assignmentId, @Valid @RequestBody ReviewActivityRequest input,
            HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(service.review(jwt.getSubject(), organizationId, programId, activityId, assignmentId,
                        input.decision(), input.comment(), id));
    }

    record CreateActivityRequest(@NotNull UUID sessionId,
                                 @NotBlank @Size(max = 255) String title,
                                 @NotBlank @Size(max = 10000) String instructions,
                                 @Size(max = 2048) String youtubeUrl,
                                 @NotNull LocalDate dueDate,
                                 @Positive int position,
                                 boolean assignToAll,
                                 @NotNull @Size(max = 100) List<@NotNull UUID> enrollmentIds) {}
    record SubmitActivityRequest(@NotBlank @Size(max = 10000) String responseText) {}
    record ReviewActivityRequest(@NotNull ActivityReviewDecision decision,
                                 @Size(max = 5000) String comment) {}
    record ActivityListResponse(List<ActivityService.ActivityResponse> items) {}
    record AssignedActivityListResponse(List<ActivityService.AssignedActivityResponse> items) {}
}
