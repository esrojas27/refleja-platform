package com.reflejatuinterior.organization;

/** Sanitized validation failure exported with the module's registration contract. */
public class InvalidOrganizationInput extends RuntimeException {
    private final String field;

    public InvalidOrganizationInput(String field) {
        super("Invalid organization input");
        this.field = field;
    }

    public String field() { return field; }
}
