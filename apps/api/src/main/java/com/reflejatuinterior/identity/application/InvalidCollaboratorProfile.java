package com.reflejatuinterior.identity.application;

public class InvalidCollaboratorProfile extends RuntimeException {
    private final String field;

    InvalidCollaboratorProfile(String field) {
        this.field = field;
    }

    public String field() {
        return field;
    }
}
