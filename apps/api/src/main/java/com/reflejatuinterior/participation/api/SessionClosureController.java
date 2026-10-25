package com.reflejatuinterior.participation.api;

import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.participation.application.*;
import com.reflejatuinterior.participation.api.ActivityEvaluationController.QuestionRequest;
import com.reflejatuinterior.participation.api.ActivityEvaluationController.SurveyAnswerRequest;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
class SessionClosureController {
    private final SessionClosureService service;
    SessionClosureController(SessionClosureService service){this.service=service;}
    @GetMapping("/api/v1/organizations/{org}/programs/{program}/session-surveys")
    ResponseEntity<?> definitions(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID org,@PathVariable UUID program){return ok(service.definitions(jwt.getSubject(),org,program));}
    @PostMapping("/api/v1/organizations/{org}/programs/{program}/sessions/{session}/survey")
    ResponseEntity<?> save(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID org,@PathVariable UUID program,@PathVariable UUID session,@Valid @RequestBody SurveyRequest input,HttpServletRequest request){
        var rid=EnrollmentController.requestId(request);
        return ok(service.save(jwt.getSubject(),org,program,session,input.version(),input.title(),input.instructions(),input.questions().stream()
            .map(q->new ActivityEvaluations.QuestionInput(q.prompt(),q.type(),q.position(),q.options())).toList(),rid),rid);
    }
    @GetMapping("/api/v1/me/programs/{program}/session-closures")
    ResponseEntity<?> owned(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID program){return ok(java.util.Map.of("items",service.owned(jwt.getSubject(),program)));}
    @PostMapping("/api/v1/me/programs/{program}/sessions/{session}/closure-acknowledgement")
    ResponseEntity<?> acknowledge(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID program,@PathVariable UUID session,HttpServletRequest request){
        var rid=EnrollmentController.requestId(request);return ok(service.acknowledge(jwt.getSubject(),program,session,rid),rid);
    }
    @PostMapping("/api/v1/me/programs/{program}/sessions/{session}/closure-response")
    ResponseEntity<?> submit(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID program,@PathVariable UUID session,@Valid @RequestBody ClosingAnswers input,HttpServletRequest request){
        var rid=EnrollmentController.requestId(request);
        return ok(service.submit(jwt.getSubject(),program,session,input.answers().stream().map(a->new ActivityEvaluationResponses.AnswerInput(a.questionId(),a.values())).toList(),rid),rid);
    }
    private static ResponseEntity<?> ok(Object value){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);}
    private static ResponseEntity<?> ok(Object value,String rid){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID",rid).body(value);}
    record SurveyRequest(@NotBlank @Size(max=255)String title,@Size(max=2000)String instructions,
        @NotNull @Size(min=1,max=20)List<@NotNull @Valid QuestionRequest> questions,@PositiveOrZero Long version){}
    record ClosingAnswers(@NotNull @Size(min=1,max=20)List<@NotNull @Valid SurveyAnswerRequest> answers){}
}
