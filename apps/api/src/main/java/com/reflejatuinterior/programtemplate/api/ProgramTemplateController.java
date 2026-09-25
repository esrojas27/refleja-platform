package com.reflejatuinterior.programtemplate.api;

import java.net.URI;
import java.time.LocalDate;
import java.util.UUID;
import com.reflejatuinterior.program.ProgramBlueprints;
import com.reflejatuinterior.programtemplate.application.ProgramTemplateData;
import com.reflejatuinterior.programtemplate.application.ProgramTemplatePage;
import com.reflejatuinterior.programtemplate.application.ProgramTemplateReadiness;
import com.reflejatuinterior.programtemplate.application.ProgramTemplateService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
class ProgramTemplateController {
    private final ProgramTemplateService service;

    ProgramTemplateController(ProgramTemplateService service) { this.service = service; }

    @GetMapping(path = "/api/v1/organizations/{organizationId}/program-templates",
            produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<ProgramTemplatePage> list(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        var id = requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(service.list(jwt.getSubject(), organizationId, page, size));
    }

    @GetMapping(path = "/api/v1/organizations/{organizationId}/programs/{programId}/template-readiness",
            produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<ProgramTemplateReadiness> readiness(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID programId, HttpServletRequest request) {
        var id = requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(service.readiness(jwt.getSubject(), organizationId, programId));
    }

    @PostMapping(path = "/api/v1/organizations/{organizationId}/program-templates",
            consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<ProgramTemplateData> createTemplate(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @Valid @RequestBody CreateTemplateRequest input,
            HttpServletRequest request) {
        var id = requestId(request);
        var result = service.createTemplate(jwt.getSubject(), organizationId, input.sourceProgramId(),
                input.name(), input.description(), id);
        return ResponseEntity.created(URI.create("/api/v1/organizations/" + organizationId
                        + "/program-templates/" + result.id()))
                .cacheControl(CacheControl.noStore()).header("X-Request-ID", id).body(result);
    }

    @PostMapping(path = "/api/v1/organizations/{organizationId}/program-templates/{templateId}/programs",
            consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<ProgramResponse> createProgram(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID templateId,
            @Valid @RequestBody CreateProgramRequest input, HttpServletRequest request) {
        var id = requestId(request);
        var result = service.createProgram(jwt.getSubject(), organizationId, templateId, input.name(),
                input.description(), input.startDate(), input.endDate(), id);
        return ResponseEntity.created(URI.create("/api/v1/organizations/" + organizationId
                        + "/programs/" + result.id()))
                .cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(ProgramResponse.from(result));
    }

    private static String requestId(HttpServletRequest request) {
        var id = UUID.randomUUID().toString();
        request.setAttribute("rti.requestId", id);
        return id;
    }

    record CreateTemplateRequest(@NotNull UUID sourceProgramId,
                                 @NotBlank @Size(max = 255) String name,
                                 @Size(max = 10000) String description) {}
    record CreateProgramRequest(@NotBlank @Size(max = 255) String name,
                                @Size(max = 10000) String description,
                                @NotNull LocalDate startDate,
                                @NotNull LocalDate endDate) {}
    record ProgramResponse(UUID id, UUID organizationId, String name, String description, String status,
                           LocalDate startDate, LocalDate endDate, long version) {
        static ProgramResponse from(ProgramBlueprints.Program program) {
            return new ProgramResponse(program.id(), program.organizationId(), program.name(),
                    program.description(), program.status(), program.startDate(), program.endDate(),
                    program.version());
        }
    }
}
