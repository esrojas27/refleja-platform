package com.reflejatuinterior.participation.api;

import java.net.URI;
import java.util.UUID;
import com.reflejatuinterior.participation.application.QuestionnaireTemplateService;
import com.reflejatuinterior.participation.application.QuestionnaireTemplates;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/organizations/{org}/questionnaire-templates")
class QuestionnaireTemplateController {
    private final QuestionnaireTemplateService service;
    QuestionnaireTemplateController(QuestionnaireTemplateService service){this.service=service;}
    @GetMapping
    ResponseEntity<QuestionnaireTemplates.Page> list(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID org,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(jwt.getSubject(),org,page,size));
    }
    @GetMapping("/{id}")
    ResponseEntity<QuestionnaireTemplates.Stored> find(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID org,@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.find(jwt.getSubject(),org,id));
    }
    @PostMapping
    ResponseEntity<QuestionnaireTemplates.Stored> create(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID org,@Valid @RequestBody CreateRequest input,HttpServletRequest request) {
        var rid=EnrollmentController.requestId(request);
        var saved=service.create(jwt.getSubject(),org,input.sourceProgramId(),input.sourceEvaluationId(),input.name(),input.description(),rid);
        return ResponseEntity.created(URI.create("/api/v1/organizations/"+org+"/questionnaire-templates/"+saved.summary().id()))
            .cacheControl(CacheControl.noStore()).header("X-Request-ID",rid).body(saved);
    }
    record CreateRequest(@NotNull UUID sourceProgramId,@NotNull UUID sourceEvaluationId,@NotBlank @Size(max=255) String name,@Size(max=2000) String description){}
}
