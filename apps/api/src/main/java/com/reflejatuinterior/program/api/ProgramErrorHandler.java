package com.reflejatuinterior.program.api;

import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.program.application.ProgramNotFound;
import com.reflejatuinterior.program.domain.InvalidProgramInput;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = ProgramController.class)
class ProgramErrorHandler {
    @ExceptionHandler(OrganizationAccess.Denied.class)
    ResponseEntity<ErrorResponse> denied(HttpServletRequest request) { return error(request, 403, "FORBIDDEN", List.of()); }

    @ExceptionHandler(ProgramNotFound.class)
    ResponseEntity<ErrorResponse> missing(HttpServletRequest request) { return error(request, 404, "PROGRAM_NOT_FOUND", List.of()); }

    @ExceptionHandler(InvalidProgramInput.class)
    ResponseEntity<ErrorResponse> invalid(InvalidProgramInput exception, HttpServletRequest request) {
        return error(request, 400, "VALIDATION_ERROR", List.of(new FieldError(exception.field(), "INVALID_VALUE", "Invalid value or date range.")));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        return error(request, 400, "VALIDATION_ERROR", exception.getBindingResult().getFieldErrors().stream()
                .map(e -> new FieldError(e.getField(), "INVALID_VALUE", "Invalid value.")).distinct().toList());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ErrorResponse> malformed(HttpServletRequest request) { return error(request, 400, "VALIDATION_ERROR", List.of()); }

    @ExceptionHandler({DataIntegrityViolationException.class, OptimisticLockingFailureException.class})
    ResponseEntity<ErrorResponse> conflict(HttpServletRequest request) { return error(request, 409, "PROGRAM_CREATION_CONFLICT", List.of()); }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(HttpServletRequest request) { return error(request, 500, "INTERNAL_ERROR", List.of()); }

    private ResponseEntity<ErrorResponse> error(HttpServletRequest request, int status, String code, List<FieldError> fields) {
        String id = request.getAttribute("rti.requestId") instanceof String value ? value : UUID.randomUUID().toString();
        String message = switch (status) {
            case 400 -> "Request validation failed.";
            case 403 -> "Operation is not permitted.";
            case 404 -> "Program resource not found.";
            case 409 -> "Program creation conflicted with persisted state.";
            default -> "The request could not be completed.";
        };
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(new ErrorResponse(code, message, id, fields));
    }
    record FieldError(String field, String code, String message) {}
    record ErrorResponse(String code, String message, String requestId, List<FieldError> errors) {}
}
