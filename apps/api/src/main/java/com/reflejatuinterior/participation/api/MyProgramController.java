package com.reflejatuinterior.participation.api;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.reflejatuinterior.participation.application.EnrollmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
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
@RequestMapping(path = "/api/v1/me/programs", produces = MediaType.APPLICATION_JSON_VALUE)
@SecurityRequirement(name = "cognitoAccessToken")
@ApiResponse(responseCode = "400", description = "Invalid UUID or pagination; VALIDATION_ERROR")
@ApiResponse(responseCode = "401", description = "Missing or invalid Cognito access token")
@ApiResponse(responseCode = "403", description = "Active collaborator access is not available; FORBIDDEN")
@ApiResponse(responseCode = "404", description = "Program is not enrolled by this collaborator; PROGRAM_NOT_FOUND")
@ApiResponse(responseCode = "500", description = "Unexpected sanitized INTERNAL_ERROR")
class MyProgramController {
    private final EnrollmentService service;

    MyProgramController(EnrollmentService service) { this.service = service; }

    @GetMapping
    @Operation(summary = "List the authenticated collaborator's programs", description = "The participant is resolved from the validated Access Token sub. "
            + "Only ACTIVE or COMPLETED enrollments in active collaborator memberships and organizations are returned. "
            + "No participantId or organizationId is accepted. Page starts at 0, default size 20, maximum 100; fixed enrollment id descending order.")
    @ApiResponse(responseCode = "200", description = "Paginated basic program metadata without participant information")
    ResponseEntity<PageResponse> list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        var result = service.myPrograms(jwt.getSubject(), page, size, id);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(new PageResponse(result.items().stream().map(ProgramResponse::from).toList(),
                        result.page(), result.size(), result.totalElements(), result.totalPages()));
    }

    @GetMapping("/{programId}")
    @Operation(summary = "Open one of the authenticated collaborator's programs", description = "Program ownership is proven by an ACTIVE or COMPLETED enrollment resolved from the token subject. "
            + "A program assigned to another person or unavailable tenant returns the same 404 response.")
    @ApiResponse(responseCode = "200", description = "Basic enrolled program metadata")
    ResponseEntity<ProgramResponse> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID programId,
            HttpServletRequest request) {
        var id = EnrollmentController.requestId(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(ProgramResponse.from(service.myProgram(jwt.getSubject(), programId, id)));
    }

    record ProgramResponse(UUID id, UUID organizationId, String organizationName, String name, String description,
                           String status, LocalDate startDate, LocalDate endDate, long version) {
        static ProgramResponse from(EnrollmentService.MyProgramResponse program) {
            return new ProgramResponse(program.id(), program.organizationId(), program.organizationName(), program.name(),
                    program.description(), program.status(), program.startDate(), program.endDate(), program.version());
        }
    }

    record PageResponse(List<ProgramResponse> items, int page, int size, long totalElements, int totalPages) {}
}
