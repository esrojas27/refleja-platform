package com.reflejatuinterior.participation.api;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.participation.application.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
class SessionScheduleController {
    private final SessionScheduleService service;
    SessionScheduleController(SessionScheduleService service) { this.service=service; }
    @GetMapping("/api/v1/organizations/{org}/programs/{program}/session-schedules")
    ResponseEntity<SessionScheduleService.Agenda> list(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID org,@PathVariable UUID program) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(jwt.getSubject(),org,program));
    }
    @PostMapping("/api/v1/organizations/{org}/programs/{program}/sessions/{session}/schedules")
    ResponseEntity<SessionScheduleService.Agenda> save(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID org,@PathVariable UUID program,@PathVariable UUID session,
            @Valid @RequestBody ScheduleRequest input,HttpServletRequest request) {
        var rid=EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID",rid)
                .body(service.schedule(jwt.getSubject(),org,program,session,input.scheduledDate(),input.participants(),input.reason(),rid));
    }
    @GetMapping("/api/v1/organizations/{org}/programs/{program}/sessions/{session}/schedule-history")
    ResponseEntity<SessionScheduleService.History> history(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID org,@PathVariable UUID program,@PathVariable UUID session,
            @RequestParam UUID enrollmentId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.history(jwt.getSubject(),org,program,session,enrollmentId,page,size));
    }
    @GetMapping("/api/v1/me/programs/{program}/sessions")
    ResponseEntity<List<SessionSchedules.OwnedSession>> owned(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID program) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.owned(jwt.getSubject(),program));
    }
    record ScheduleRequest(@NotNull LocalDate scheduledDate,@NotEmpty @Size(max=500) List<SessionScheduleService.Target> participants,@Size(max=1000) String reason) {}
}
