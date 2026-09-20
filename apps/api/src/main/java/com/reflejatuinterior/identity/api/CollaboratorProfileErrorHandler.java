package com.reflejatuinterior.identity.api;

import java.util.List;
import java.util.UUID;

import com.reflejatuinterior.identity.application.CollaboratorProfileUnavailable;
import com.reflejatuinterior.identity.application.IdentityAccessDeniedException;
import com.reflejatuinterior.identity.application.InvalidCollaboratorProfile;
import com.reflejatuinterior.identity.application.OrganizationUnavailableException;
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

@RestControllerAdvice(assignableTypes = CollaboratorProfileController.class)
class CollaboratorProfileErrorHandler {
    @ExceptionHandler(IdentityAccessDeniedException.class)
    ResponseEntity<ErrorResponse> denied(HttpServletRequest request) {
        return error(request, 403, "FORBIDDEN", List.of());
    }

    @ExceptionHandler({CollaboratorProfileUnavailable.class, OrganizationUnavailableException.class})
    ResponseEntity<ErrorResponse> unavailable(HttpServletRequest request) {
        return error(request, 404, "PROFILE_NOT_AVAILABLE", List.of());
    }

    @ExceptionHandler(InvalidCollaboratorProfile.class)
    ResponseEntity<ErrorResponse> invalid(InvalidCollaboratorProfile exception, HttpServletRequest request) {
        return error(request, 400, "VALIDATION_ERROR", List.of(field(exception.field())));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        return error(request, 400, "VALIDATION_ERROR", exception.getBindingResult().getFieldErrors().stream()
                .map(item -> field(item.getField())).distinct().toList());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ErrorResponse> malformed(HttpServletRequest request) {
        return error(request, 400, "VALIDATION_ERROR", List.of());
    }

    @ExceptionHandler({DataIntegrityViolationException.class, OptimisticLockingFailureException.class})
    ResponseEntity<ErrorResponse> conflict(HttpServletRequest request) {
        return error(request, 409, "PROFILE_CONFLICT", List.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(HttpServletRequest request) {
        return error(request, 500, "INTERNAL_ERROR", List.of());
    }

    private static FieldError field(String name) {
        return new FieldError(name, "INVALID_VALUE", "Invalid value.");
    }

    private ResponseEntity<ErrorResponse> error(HttpServletRequest request, int status, String code,
                                                List<FieldError> fields) {
        String requestId = request.getAttribute("rti.requestId") instanceof String id ? id : UUID.randomUUID().toString();
        String message = switch (status) {
            case 400 -> "Request validation failed.";
            case 403 -> "Profile access is not permitted.";
            case 404 -> "Collaborator profile is not available.";
            case 409 -> "Profile update conflicted with persisted state.";
            default -> "The request could not be completed.";
        };
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).header("X-Request-ID", requestId)
                .body(new ErrorResponse(code, message, requestId, fields));
    }

    record FieldError(String field, String code, String message) {
    }

    record ErrorResponse(String code, String message, String requestId, List<FieldError> errors) {
    }
}
