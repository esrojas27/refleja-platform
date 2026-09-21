package com.reflejatuinterior.participation.domain;

public class InvalidDiscProfile extends RuntimeException {
    private final String field;

    public InvalidDiscProfile(String field) { this.field = field; }

    public String field() { return field; }
}
