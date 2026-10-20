package com.reflejatuinterior.participation.api;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import com.reflejatuinterior.participation.application.SurveyResults;
import com.reflejatuinterior.participation.application.SurveyResultsCsv;
import com.reflejatuinterior.participation.application.SurveyResultsService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/programs/{programId}/survey-results")
class SurveyResultsController {
    private final SurveyResultsService service;
    SurveyResultsController(SurveyResultsService service) { this.service = service; }
    @GetMapping
    ResponseEntity<SurveyResults> results(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
            @PathVariable UUID programId, @RequestParam(required=false) UUID dimensionId,
            @RequestParam(required=false) UUID sessionId, @RequestParam(required=false) UUID activityId, HttpServletRequest request) {
        var rid = EnrollmentController.requestId(request);
        var report = service.load(jwt.getSubject(), organizationId, programId, new SurveyResults.Scope(dimensionId, sessionId, activityId), false, rid);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", rid).body(report);
    }
    @GetMapping("/export")
    ResponseEntity<byte[]> export(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
            @PathVariable UUID programId, @RequestParam(required=false) UUID dimensionId,
            @RequestParam(required=false) UUID sessionId, @RequestParam(required=false) UUID activityId, HttpServletRequest request) {
        var rid = EnrollmentController.requestId(request);
        var report = service.load(jwt.getSubject(), organizationId, programId, new SurveyResults.Scope(dimensionId, sessionId, activityId), true, rid);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", rid)
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("encuestas-" + programId + ".csv").build().toString())
                .body(SurveyResultsCsv.render(report));
    }
}
