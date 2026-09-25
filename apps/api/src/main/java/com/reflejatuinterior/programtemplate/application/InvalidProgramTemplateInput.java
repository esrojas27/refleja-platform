package com.reflejatuinterior.programtemplate.application;

public class InvalidProgramTemplateInput extends RuntimeException {
    private final String field;
    public InvalidProgramTemplateInput(String field) { this.field = field; }
    public String field() { return field; }
}
