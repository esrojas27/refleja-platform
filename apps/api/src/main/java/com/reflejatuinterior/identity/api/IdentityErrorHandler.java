package com.reflejatuinterior.identity.api;

import java.util.UUID;

import com.reflejatuinterior.identity.application.IdentityAccessDeniedException;
import com.reflejatuinterior.identity.application.OrganizationUnavailableException;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = MeController.class)
class IdentityErrorHandler {
    @ExceptionHandler(IdentityAccessDeniedException.class)
    ResponseEntity<ErrorResponse> denied() {
        return error(403, "FORBIDDEN", "Internal access is not available.");
    }

    @ExceptionHandler(OrganizationUnavailableException.class)
    ResponseEntity<ErrorResponse> unavailable() {
        return error(404, "ORGANIZATION_NOT_AVAILABLE", "Organization is not available.");
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ErrorResponse> invalidIdentifier() {
        return error(400, "VALIDATION_ERROR", "The organization identifier is invalid.");
    }

    private ResponseEntity<ErrorResponse> error(int status, String code, String message) {
        String requestId = UUID.randomUUID().toString();
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .header("X-Request-ID", requestId).body(new ErrorResponse(code, message, requestId));
    }

    record ErrorResponse(String code, String message, String requestId) {
    }
}
