package com.reflejatuinterior.program.api;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.program.application.ProgramData;
import com.reflejatuinterior.program.application.ProgramService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
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
@RequestMapping(path = "/api/v1/organizations/{organizationId}/programs", produces = MediaType.APPLICATION_JSON_VALUE)
@SecurityRequirement(name = "cognitoAccessToken")
@ApiResponse(responseCode = "400", description = "Invalid JSON, field, UUID, date or pagination; VALIDATION_ERROR with requestId")
@ApiResponse(responseCode = "401", description = "Missing or invalid Cognito access token")
@ApiResponse(responseCode = "403", description = "Inactive internal user or insufficient role in authorized organization")
@ApiResponse(responseCode = "404", description = "Resource missing or outside authorized tenant; PROGRAM_NOT_FOUND")
@ApiResponse(responseCode = "500", description = "Unexpected failure; sanitized INTERNAL_ERROR with requestId")
class ProgramController {
    private final ProgramService programs;
    ProgramController(ProgramService programs) { this.programs = programs; }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Create a DRAFT program", description = "Active CONSULTANT in the active target organization. "
            + "Name: 1–255 characters, description optional up to 10000 characters, required ISO dates (years 0001–9999), startDate <= endDate. "
            + "No client-controlled ID, status, version or primary consultant assignment. POST is not deduplicated.")
    @ApiResponse(responseCode = "201", description = "Program created; UUIDv7, DRAFT, version 0; Location points to detail")
    @ApiResponse(responseCode = "409", description = "Persistence conflict; PROGRAM_CREATION_CONFLICT, no partial creation")
    ResponseEntity<ProgramResponse> create(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
            @Valid @RequestBody CreateRequest input, HttpServletRequest request) {
        var id = requestId(request);
        var result = programs.create(jwt.getSubject(), organizationId, input.name(), input.description(), input.startDate(), input.endDate(), id);
        return ResponseEntity.created(URI.create("/api/v1/organizations/" + result.organizationId() + "/programs/" + result.id()))
                .cacheControl(CacheControl.noStore()).header("X-Request-ID", id).body(ProgramResponse.from(result));
    }

    @GetMapping
    @Operation(summary = "List basic program metadata in an authorized organization", description = "Active CONSULTANT, COMPANY_ADMIN or LEADER. "
            + "No participant data. Page starts at 0, default size 20, maximum 100; page*size must fit a signed 32-bit offset. Fixed id descending order; no sort/filter parameters supported.")
    @ApiResponse(responseCode = "200", description = "Paginated programs; totals are tenant-scoped")
    ResponseEntity<PageResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        var id = requestId(request);
        var result = programs.list(jwt.getSubject(), organizationId, page, size, id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(new PageResponse(result.items().stream().map(ProgramResponse::from).toList(), result.page(), result.size(), result.totalElements(), result.totalPages()));
    }

    @GetMapping("/{programId}")
    @Operation(summary = "Consult basic program detail", description = "Active CONSULTANT, COMPANY_ADMIN or LEADER in the target organization. "
            + "Both organizationId and programId are checked together; unknown and cross-tenant resources return the same 404.")
    @ApiResponse(responseCode = "200", description = "Direct program DTO; no JPA entity, memberships or participant data")
    ResponseEntity<ProgramResponse> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID organizationId,
            @PathVariable UUID programId, HttpServletRequest request) {
        var id = requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(ProgramResponse.from(programs.detail(jwt.getSubject(), organizationId, programId, id)));
    }

    private String requestId(HttpServletRequest request) {
        String id = UUID.randomUUID().toString(); request.setAttribute("rti.requestId", id); return id;
    }

    record CreateRequest(@NotBlank @Size(max = 255) String name, @Size(max = 10000) String description,
                         @NotNull LocalDate startDate, @NotNull LocalDate endDate) {}
    record ProgramResponse(UUID id, UUID organizationId, String name, String description, String status,
                           LocalDate startDate, LocalDate endDate, long version) {
        static ProgramResponse from(ProgramData data) {
            return new ProgramResponse(data.id(), data.organizationId(), data.name(), data.description(), data.status(), data.startDate(), data.endDate(), data.version());
        }
    }
    record PageResponse(List<ProgramResponse> items, int page, int size, long totalElements, int totalPages) {}
}
