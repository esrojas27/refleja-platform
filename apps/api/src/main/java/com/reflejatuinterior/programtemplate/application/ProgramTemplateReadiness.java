package com.reflejatuinterior.programtemplate.application;

import java.util.List;

public record ProgramTemplateReadiness(boolean eligible, int dimensionCount, int sessionCount,
                                       int activityCount, int surveyCount, List<String> issues) {
    public ProgramTemplateReadiness { issues = List.copyOf(issues); }
}
