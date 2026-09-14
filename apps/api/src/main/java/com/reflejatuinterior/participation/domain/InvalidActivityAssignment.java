package com.reflejatuinterior.participation.domain;

public class InvalidActivityAssignment extends RuntimeException {
    private final String field;
    public InvalidActivityAssignment(String field) { this.field = field; }
    public String field() { return field; }
}
