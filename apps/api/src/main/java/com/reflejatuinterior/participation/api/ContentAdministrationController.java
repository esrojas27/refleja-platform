package com.reflejatuinterior.participation.api;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.participation.application.ContentAdministrationService;
import com.reflejatuinterior.participation.application.ActivityEvaluations;
import com.reflejatuinterior.participation.api.ActivityEvaluationController.QuestionRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/programs/{programId}/content")
class ContentAdministrationController {
    private final ContentAdministrationService service;
    ContentAdministrationController(ContentAdministrationService service) { this.service = service; }

    @PutMapping("/dimensions/{id}")
    ResponseEntity<Void> dimension(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId, @PathVariable UUID programId,
            @PathVariable UUID id, @Valid @RequestBody DimensionRequest input, HttpServletRequest request) {
        var rid = EnrollmentController.requestId(request);
        service.editDimension(jwt.getSubject(), organizationId, programId, id, input.version(), input.name(), input.description(), rid);
        return done(rid);
    }
    @PutMapping("/sessions/{id}")
    ResponseEntity<Void> session(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId, @PathVariable UUID programId,
            @PathVariable UUID id, @Valid @RequestBody SessionRequest input, HttpServletRequest request) {
        var rid = EnrollmentController.requestId(request);
        service.editSession(jwt.getSubject(), organizationId, programId, id, input.version(), input.name(), input.objective(), null, rid);
        return done(rid);
    }
    @PutMapping("/activities/{id}")
    ResponseEntity<Void> activity(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId, @PathVariable UUID programId,
            @PathVariable UUID id, @Valid @RequestBody ActivityRequest input, HttpServletRequest request) {
        var rid = EnrollmentController.requestId(request);
        service.editActivity(jwt.getSubject(), organizationId, programId, id, input.version(), input.title(), input.instructions(), input.youtubeUrl(), null, rid);
        return done(rid);
    }
    @PutMapping("/activities/{id}/survey")
    ResponseEntity<ActivityEvaluations.Evaluation> survey(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId, @PathVariable UUID programId,
            @PathVariable UUID id, @Valid @RequestBody SurveyRequest input, HttpServletRequest request) {
        var rid = EnrollmentController.requestId(request);
        var result = service.editSurvey(jwt.getSubject(), organizationId, programId, id, input.version(), input.title(), input.instructions(),
                input.questions().stream().map(q -> new ActivityEvaluations.QuestionInput(q.prompt(), q.type(), q.position())).toList(), rid);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", rid).body(result);
    }
    @PostMapping("/{kind}/{id}/archive")
    ResponseEntity<Void> archive(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId, @PathVariable UUID programId,
            @PathVariable String kind, @PathVariable UUID id, @Valid @RequestBody ArchiveRequest input, HttpServletRequest request) {
        var rid = EnrollmentController.requestId(request);
        service.archive(jwt.getSubject(), organizationId, programId, kind, id, input.version(), input.archived(), rid); return done(rid);
    }
    @PostMapping("/{kind}/{id}/move")
    ResponseEntity<Void> move(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId, @PathVariable UUID programId,
            @PathVariable String kind, @PathVariable UUID id, @Valid @RequestBody MoveRequest input, HttpServletRequest request) {
        var rid = EnrollmentController.requestId(request);
        service.move(jwt.getSubject(), organizationId, programId, kind, id, input.version(), input.direction().equals("UP"), rid); return done(rid);
    }
    @PostMapping("/{kind}/{id}/delete")
    ResponseEntity<Void> remove(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId, @PathVariable UUID programId,
            @PathVariable String kind, @PathVariable UUID id, @Valid @RequestBody VersionRequest input, HttpServletRequest request) {
        var rid = EnrollmentController.requestId(request);
        service.remove(jwt.getSubject(), organizationId, programId, kind, id, input.version(), rid); return done(rid);
    }
    @PostMapping("/activities/{id}/duplicate")
    ResponseEntity<Duplicated> duplicate(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId, @PathVariable UUID programId,
            @PathVariable UUID id, @Valid @RequestBody DuplicateRequest input, HttpServletRequest request) {
        var rid = EnrollmentController.requestId(request);
        var result = service.duplicate(jwt.getSubject(), organizationId, programId, id, input.version(), rid);
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).header("X-Request-ID", rid).body(new Duplicated(result));
    }
    private ResponseEntity<Void> done(String rid) { return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).header("X-Request-ID", rid).build(); }
    record DimensionRequest(@NotBlank @Size(max=255) String name, @Size(max=10000) String description, @NotNull @PositiveOrZero Long version) {}
    record SessionRequest(@NotBlank @Size(max=255) String name, @Size(max=10000) String objective, @NotNull @PositiveOrZero Long version) {}
    record ActivityRequest(@NotBlank @Size(max=255) String title, @NotBlank @Size(max=10000) String instructions,
            @Size(max=2048) String youtubeUrl, @NotNull @PositiveOrZero Long version) {}
    record SurveyRequest(@NotBlank @Size(max=255) String title, @Size(max=2000) String instructions,
            @NotNull @Size(min=1,max=20) List<@Valid QuestionRequest> questions, @NotNull @PositiveOrZero Long version) {}
    record VersionRequest(@NotNull @PositiveOrZero Long version) {}
    record ArchiveRequest(@NotNull @PositiveOrZero Long version, @NotNull Boolean archived) {}
    record MoveRequest(@NotNull @PositiveOrZero Long version, @NotNull @Pattern(regexp="UP|DOWN") String direction) {}
    record DuplicateRequest(@NotNull @PositiveOrZero Long version) {}
    record Duplicated(UUID id) {}
}
