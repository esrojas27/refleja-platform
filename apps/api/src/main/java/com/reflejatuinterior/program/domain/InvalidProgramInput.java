package com.reflejatuinterior.program.domain;

public class InvalidProgramInput extends RuntimeException {
    private final String field;
    public InvalidProgramInput(String field) { this.field = field; }
    public String field() { return field; }
}
