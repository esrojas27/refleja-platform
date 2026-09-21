package com.reflejatuinterior.participation.domain;

public final class InvalidActivityEvaluation extends RuntimeException {
    private final String field;
    public InvalidActivityEvaluation(String field) { this.field = field; }
    public String field() { return field; }
}
