package com.reflejatuinterior.participation.application;

public class EnrollmentAdministrationConflict extends RuntimeException {
    private final String code;
    public EnrollmentAdministrationConflict(String code) { this.code = code; }
    public String code() { return code; }
}
