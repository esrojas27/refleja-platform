package com.reflejatuinterior.participation.api;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.participation.application.ActivityEvaluationService;
import com.reflejatuinterior.participation.application.ActivityEvaluations;
import com.reflejatuinterior.participation.domain.EvaluationQuestionType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
class ActivityEvaluationController {
    private final ActivityEvaluationService service;
    ActivityEvaluationController(ActivityEvaluationService service) { this.service = service; }

    @GetMapping(path = "/api/v1/organizations/{organizationId}/programs/{programId}/evaluations",
            produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "List post-activity evaluations configured for a program")
    ResponseEntity<EvaluationListResponse> list(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID programId, HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(new EvaluationListResponse(service.list(jwt.getSubject(), organizationId, programId, id)));
    }

    @PostMapping(path = "/api/v1/organizations/{organizationId}/programs/{programId}/activities/{activityId}/evaluation",
            consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Create the post-activity evaluation and its ordered questions")
    @ApiResponse(responseCode = "201", description = "Evaluation created")
    ResponseEntity<ActivityEvaluations.Evaluation> create(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID programId, @PathVariable UUID activityId,
            @Valid @RequestBody CreateEvaluationRequest input, HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        var result = service.create(jwt.getSubject(), organizationId, programId, activityId,
                input.title(), input.instructions(), input.questions().stream()
                        .map(question -> new ActivityEvaluations.QuestionInput(
                                question.prompt(), question.type(), question.position())).toList(), id);
        var location = "/api/v1/organizations/" + organizationId + "/programs/" + programId
                + "/activities/" + activityId + "/evaluation";
        return ResponseEntity.created(URI.create(location)).cacheControl(CacheControl.noStore())
                .header("X-Request-ID", id).body(result);
    }

    @PostMapping(path = "/api/v1/me/programs/{programId}/activities/{activityId}/survey-response",
            consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Complete the authenticated collaborator's survey after submitting the activity")
    @ApiResponse(responseCode = "200", description = "Survey completed")
    ResponseEntity<ActivityEvaluationService.SurveySubmission> submitSurvey(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID programId, @PathVariable UUID activityId,
            @Valid @RequestBody SubmitSurveyRequest input, HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        var result = service.submit(jwt.getSubject(), programId, activityId, input.answers().stream()
                .map(answer -> new com.reflejatuinterior.participation.application.ActivityEvaluationResponses.AnswerInput(
                        answer.questionId(), answer.values())).toList(), id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id).body(result);
    }

    record CreateEvaluationRequest(@NotBlank @Size(max = 255) String title,
                                   @Size(max = 2000) String instructions,
                                   @NotNull @Size(min = 1, max = 20) List<@Valid QuestionRequest> questions) {}
    record QuestionRequest(@NotBlank @Size(max = 500) String prompt,
                           @NotNull EvaluationQuestionType type,
                           @Positive int position) {}
    record SubmitSurveyRequest(@NotNull @Size(min = 1, max = 20) List<@Valid SurveyAnswerRequest> answers) {}
    record SurveyAnswerRequest(@NotNull UUID questionId,
                               @NotNull @Size(min = 1, max = 2) List<@NotBlank @Size(max = 5000) String> values) {}
    record EvaluationListResponse(List<ActivityEvaluations.Evaluation> items) {}
}
