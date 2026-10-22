package com.reflejatuinterior.participation.api;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import com.reflejatuinterior.participation.application.ProgramReport;
import com.reflejatuinterior.participation.application.ProgramReportExport;
import com.reflejatuinterior.participation.application.ProgramReportService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/programs/{programId}/reports")
class ProgramReportController {
    private final ProgramReportService service;
    ProgramReportController(ProgramReportService service) { this.service = service; }
    @GetMapping
    ResponseEntity<ProgramReport> report(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
            @PathVariable UUID programId, @RequestParam(required = false) UUID enrollmentId, HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(service.load(jwt.getSubject(), organizationId, programId, enrollmentId, false, id));
    }
    @GetMapping("/export")
    ResponseEntity<byte[]> export(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
            @PathVariable UUID programId, @RequestParam(required = false) UUID enrollmentId,
            @RequestParam(defaultValue = "csv") String format, HttpServletRequest request) {
        if (!format.equals("csv") && !format.equals("xlsx")) throw new com.reflejatuinterior.program.ProgramActivities.InvalidInput("format");
        var id = EnrollmentController.requestId(request);
        var report = service.load(jwt.getSubject(), organizationId, programId, enrollmentId, true, id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .contentType(format.equals("csv") ? new MediaType("text", "csv", StandardCharsets.UTF_8)
                        : MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("reporte-" + programId + (enrollmentId == null ? "" : "-" + enrollmentId) + "." + format).build().toString())
                .body(format.equals("csv") ? ProgramReportExport.csv(report) : ProgramReportExport.xlsx(report));
    }
}
