package com.reflejatuinterior.participation.domain;

public final class InvalidActivitySurveyResponse extends RuntimeException {
    private final String field;
    public InvalidActivitySurveyResponse(String field) { this.field = field; }
    public String field() { return field; }
}
