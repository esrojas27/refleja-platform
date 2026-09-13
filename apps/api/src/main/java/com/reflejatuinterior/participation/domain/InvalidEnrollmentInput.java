package com.reflejatuinterior.participation.domain;

public class InvalidEnrollmentInput extends RuntimeException {
    private final String field;
    public InvalidEnrollmentInput(String field) { this.field = field; }
    public String field() { return field; }
}
