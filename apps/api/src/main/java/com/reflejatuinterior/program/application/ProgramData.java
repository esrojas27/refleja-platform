package com.reflejatuinterior.program.application;

import java.time.LocalDate;
import java.util.UUID;

public record ProgramData(UUID id, UUID organizationId, String name, String description, String status,
                          LocalDate startDate, LocalDate endDate, long version) {}
