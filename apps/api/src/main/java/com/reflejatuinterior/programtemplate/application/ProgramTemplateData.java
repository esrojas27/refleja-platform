package com.reflejatuinterior.programtemplate.application;

import java.time.Instant;
import java.util.UUID;

public record ProgramTemplateData(UUID id, UUID sourceOrganizationId, UUID sourceProgramId,
                                  String name, String description, String sourceProgramName,
                                  long durationDays, int dimensionCount, int sessionCount,
                                  int activityCount, int surveyCount, Instant createdAt, long version) {}
