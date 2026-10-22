package com.reflejatuinterior.participation.api;

import java.time.Instant;
import java.util.UUID;
import com.reflejatuinterior.participation.application.NotificationService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/me/notifications")
class NotificationController {
    private final NotificationService service;
    NotificationController(NotificationService service) { this.service=service; }
    @GetMapping
    ResponseEntity<NotificationService.Page> list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required=false) Instant before,@RequestParam(required=false) UUID beforeId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(jwt.getSubject(),before,beforeId));
    }
    @PostMapping("/{id}/read")
    ResponseEntity<Void> read(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id) {
        service.markRead(jwt.getSubject(),id);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
}
