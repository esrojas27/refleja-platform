package com.reflejatuinterior.participation.api;

import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.identity.CollaboratorInvitations;
import com.reflejatuinterior.identity.CollaboratorAccess;
import com.reflejatuinterior.identity.OrganizationAccess;
import com.reflejatuinterior.participation.application.EnrollmentConflict;
import com.reflejatuinterior.participation.application.EnrollmentNotFound;
import com.reflejatuinterior.participation.application.MyProgramNotFound;
import com.reflejatuinterior.participation.domain.InvalidEnrollmentInput;
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

@RestControllerAdvice(assignableTypes = {EnrollmentController.class, InvitationController.class, MyProgramController.class})
class EnrollmentErrorHandler {
    @ExceptionHandler({OrganizationAccess.Denied.class, CollaboratorInvitations.Denied.class, CollaboratorAccess.Denied.class})
    ResponseEntity<ErrorResponse> denied(HttpServletRequest request) { return error(request, 403, "FORBIDDEN", List.of()); }

    @ExceptionHandler({EnrollmentNotFound.class, CollaboratorInvitations.Unavailable.class})
    ResponseEntity<ErrorResponse> missing(HttpServletRequest request) { return error(request, 404, "ENROLLMENT_NOT_FOUND", List.of()); }

    @ExceptionHandler(MyProgramNotFound.class)
    ResponseEntity<ErrorResponse> programMissing(HttpServletRequest request) {
        return error(request, 404, "PROGRAM_NOT_FOUND", "Program resource not found.", List.of());
    }

    @ExceptionHandler(CollaboratorInvitations.Expired.class)
    ResponseEntity<ErrorResponse> expired(HttpServletRequest request) { return error(request, 410, "INVITATION_EXPIRED", List.of()); }

    @ExceptionHandler(CollaboratorInvitations.DeliveryUnavailable.class)
    ResponseEntity<ErrorResponse> unavailable(HttpServletRequest request) { return error(request, 503, "INVITATION_SERVICE_UNAVAILABLE", List.of()); }

    @ExceptionHandler({EnrollmentConflict.class, CollaboratorInvitations.Conflict.class, DataIntegrityViolationException.class,
            OptimisticLockingFailureException.class})
    ResponseEntity<ErrorResponse> conflict(HttpServletRequest request) { return error(request, 409, "ENROLLMENT_CONFLICT", List.of()); }

    @ExceptionHandler(InvalidEnrollmentInput.class)
    ResponseEntity<ErrorResponse> invalid(InvalidEnrollmentInput exception, HttpServletRequest request) {
        return error(request, 400, "VALIDATION_ERROR", List.of(field(exception.field())));
    }

    @ExceptionHandler(CollaboratorInvitations.InvalidInput.class)
    ResponseEntity<ErrorResponse> invalidIdentity(CollaboratorInvitations.InvalidInput exception, HttpServletRequest request) {
        return error(request, 400, "VALIDATION_ERROR", exception.fields().stream().map(EnrollmentErrorHandler::field).toList());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        return error(request, 400, "VALIDATION_ERROR", exception.getBindingResult().getFieldErrors().stream()
                .map(e -> field(e.getField())).distinct().toList());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ErrorResponse> malformed(HttpServletRequest request) { return error(request, 400, "VALIDATION_ERROR", List.of()); }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(HttpServletRequest request) { return error(request, 500, "INTERNAL_ERROR", List.of()); }

    private static FieldError field(String name) { return new FieldError(name, "INVALID_VALUE", "Invalid value."); }

    private ResponseEntity<ErrorResponse> error(HttpServletRequest request, int status, String code, List<FieldError> fields) {
        return error(request, status, code, null, fields);
    }

    private ResponseEntity<ErrorResponse> error(HttpServletRequest request, int status, String code, String explicitMessage,
                                                List<FieldError> fields) {
        String id = request.getAttribute("rti.requestId") instanceof String value ? value : UUID.randomUUID().toString();
        String message = explicitMessage != null ? explicitMessage : switch (status) {
            case 400 -> "Request validation failed.";
            case 403 -> "Operation is not permitted.";
            case 404 -> "Enrollment or invitation resource not found.";
            case 409 -> "Operation conflicted with persisted state.";
            case 410 -> "The invitation has expired.";
            case 503 -> "Invitation service is unavailable.";
            default -> "The request could not be completed.";
        };
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).header("X-Request-ID", id)
                .body(new ErrorResponse(code, message, id, fields));
    }

    record FieldError(String field, String code, String message) {}
    record ErrorResponse(String code, String message, String requestId, List<FieldError> errors) {}
}
