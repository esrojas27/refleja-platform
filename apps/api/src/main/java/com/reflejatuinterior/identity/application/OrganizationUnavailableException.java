package com.reflejatuinterior.identity.application;

public final class OrganizationUnavailableException extends RuntimeException {
    public OrganizationUnavailableException() {
        super("Organization is not available");
    }
}
