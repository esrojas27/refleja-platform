package com.reflejatuinterior.programtemplate.api;

import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.program.ProgramBlueprints;
import com.reflejatuinterior.programtemplate.application.InvalidProgramTemplateInput;
import com.reflejatuinterior.programtemplate.application.ProgramTemplateIncomplete;
import com.reflejatuinterior.programtemplate.application.ProgramTemplateNotFound;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = ProgramTemplateController.class)
class ProgramTemplateErrorHandler {
    @ExceptionHandler(OrganizationAccess.Denied.class)
    ResponseEntity<ErrorResponse> denied(HttpServletRequest request) {
        return error(request, 403, "FORBIDDEN", List.of(), List.of());
    }

    @ExceptionHandler(ProgramTemplateNotFound.class)
    ResponseEntity<ErrorResponse> missing(HttpServletRequest request) {
        return error(request, 404, "PROGRAM_TEMPLATE_NOT_FOUND", List.of(), List.of());
    }

    @ExceptionHandler(ProgramTemplateIncomplete.class)
    ResponseEntity<ErrorResponse> incomplete(ProgramTemplateIncomplete exception, HttpServletRequest request) {
        return error(request, 409, "PROGRAM_TEMPLATE_INCOMPLETE", List.of(), exception.issues());
    }

    @ExceptionHandler({InvalidProgramTemplateInput.class, ProgramBlueprints.InvalidInput.class})
    ResponseEntity<ErrorResponse> invalid(RuntimeException exception, HttpServletRequest request) {
        var field = exception instanceof InvalidProgramTemplateInput value ? value.field()
                : ((ProgramBlueprints.InvalidInput) exception).field();
        return error(request, 400, "VALIDATION_ERROR", List.of(new FieldError(field, "INVALID_VALUE")), List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        return error(request, 400, "VALIDATION_ERROR", exception.getBindingResult().getFieldErrors().stream()
                .map(item -> new FieldError(item.getField(), "INVALID_VALUE")).distinct().toList(), List.of());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ErrorResponse> malformed(HttpServletRequest request) {
        return error(request, 400, "VALIDATION_ERROR", List.of(), List.of());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ErrorResponse> conflict(HttpServletRequest request) {
        return error(request, 409, "PROGRAM_TEMPLATE_CONFLICT", List.of(), List.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(HttpServletRequest request) {
        return error(request, 500, "INTERNAL_ERROR", List.of(), List.of());
    }

    private static ResponseEntity<ErrorResponse> error(HttpServletRequest request, int status, String code,
            List<FieldError> fields, List<String> issues) {
        var id = request.getAttribute("rti.requestId") instanceof String value
                ? value : UUID.randomUUID().toString();
        var message = switch (status) {
            case 400 -> "Request validation failed.";
            case 403 -> "Operation is not permitted.";
            case 404 -> "Program template resource not found.";
            case 409 -> "Program template operation conflicted with persisted state.";
            default -> "The request could not be completed.";
        };
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(new ErrorResponse(code, message, id, fields, issues));
    }

    record FieldError(String field, String code) {}
    record ErrorResponse(String code, String message, String requestId,
                         List<FieldError> errors, List<String> issues) {}
}
