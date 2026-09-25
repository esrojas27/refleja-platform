package com.reflejatuinterior.programtemplate.application;

import java.util.List;

public class ProgramTemplateIncomplete extends RuntimeException {
    private final List<String> issues;
    public ProgramTemplateIncomplete(List<String> issues) { this.issues = List.copyOf(issues); }
    public List<String> issues() { return issues; }
}
