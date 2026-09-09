package com.reflejatuinterior.identity.application;

public final class IdentityAccessDeniedException extends RuntimeException {
    public IdentityAccessDeniedException() {
        super("Internal access is not available");
    }
}
