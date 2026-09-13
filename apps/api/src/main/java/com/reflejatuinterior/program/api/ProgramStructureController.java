package com.reflejatuinterior.program.api;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.program.application.ProgramModuleData;
import com.reflejatuinterior.program.application.ProgramSessionData;
import com.reflejatuinterior.program.application.ProgramStructureService;
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
@RequestMapping(path = "/api/v1/organizations/{organizationId}/programs/{programId}/modules",
        produces = MediaType.APPLICATION_JSON_VALUE)
@SecurityRequirement(name = "cognitoAccessToken")
@ApiResponse(responseCode = "401", description = "Missing or invalid Cognito access token")
@ApiResponse(responseCode = "403", description = "Only an active CONSULTANT in the authorized organization may access structure")
@ApiResponse(responseCode = "404", description = "Program or module missing or outside authorized tenant")
class ProgramStructureController {
    private final ProgramStructureService structure;

    ProgramStructureController(ProgramStructureService structure) { this.structure = structure; }

    @GetMapping
    @Operation(summary = "List the ordered module and session structure of a program")
    ResponseEntity<ModuleListResponse> list(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID programId, HttpServletRequest request) {
        var id = requestId(request);
        var items = structure.list(jwt.getSubject(), organizationId, programId, id).stream()
                .map(ModuleResponse::from).toList();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(new ModuleListResponse(items));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Append an ordered module to a program")
    @ApiResponse(responseCode = "201", description = "Module created with UUIDv7 and version 0")
    ResponseEntity<ModuleResponse> createModule(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID programId,
            @Valid @RequestBody CreateModuleRequest input, HttpServletRequest request) {
        var id = requestId(request);
        var result = structure.createModule(jwt.getSubject(), organizationId, programId,
                input.name(), input.description(), input.position(), id);
        var location = "/api/v1/organizations/" + organizationId + "/programs/" + programId + "/modules/" + result.id();
        return ResponseEntity.created(URI.create(location)).cacheControl(CacheControl.noStore())
                .header("X-Request-ID", id).body(ModuleResponse.from(result));
    }

    @PostMapping(path = "/{moduleId}/sessions", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Append an ordered dated session to a program module")
    @ApiResponse(responseCode = "201", description = "Session created with UUIDv7 and version 0")
    ResponseEntity<SessionResponse> createSession(@AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID organizationId, @PathVariable UUID programId, @PathVariable UUID moduleId,
            @Valid @RequestBody CreateSessionRequest input, HttpServletRequest request) {
        var id = requestId(request);
        var result = structure.createSession(jwt.getSubject(), organizationId, programId, moduleId,
                input.name(), input.description(), input.scheduledDate(), input.position(), id);
        var location = "/api/v1/organizations/" + organizationId + "/programs/" + programId
                + "/modules/" + moduleId + "/sessions/" + result.id();
        return ResponseEntity.created(URI.create(location)).cacheControl(CacheControl.noStore())
                .header("X-Request-ID", id).body(SessionResponse.from(result));
    }

    private String requestId(HttpServletRequest request) {
        String id = UUID.randomUUID().toString();
        request.setAttribute("rti.requestId", id);
        return id;
    }

    record CreateModuleRequest(@NotBlank @Size(max = 255) String name,
                               @Size(max = 10000) String description,
                               @Positive int position) {}
    record CreateSessionRequest(@NotBlank @Size(max = 255) String name,
                                @Size(max = 10000) String description,
                                @NotNull LocalDate scheduledDate,
                                @Positive int position) {}
    record ModuleListResponse(List<ModuleResponse> items) {}
    record ModuleResponse(UUID id, UUID organizationId, UUID programId, String name, String description,
                          int position, long version, List<SessionResponse> sessions) {
        static ModuleResponse from(ProgramModuleData data) {
            return new ModuleResponse(data.id(), data.organizationId(), data.programId(), data.name(),
                    data.description(), data.position(), data.version(),
                    data.sessions().stream().map(SessionResponse::from).toList());
        }
    }
    record SessionResponse(UUID id, UUID organizationId, UUID programId, UUID moduleId, String name,
                           String description, LocalDate scheduledDate, int position, long version) {
        static SessionResponse from(ProgramSessionData data) {
            return new SessionResponse(data.id(), data.organizationId(), data.programId(), data.moduleId(),
                    data.name(), data.description(), data.scheduledDate(), data.position(), data.version());
        }
    }
}
