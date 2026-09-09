package com.reflejatuinterior.program.domain;

import java.time.LocalDate;

public record NewProgram(String name, String description, LocalDate startDate, LocalDate endDate) {
    public NewProgram {
        if (name == null || name.isBlank() || name.length() > 255 || name.codePoints().anyMatch(Character::isISOControl)) {
            throw new InvalidProgramInput("name");
        }
        name = name.strip();
        // Technical input bound, not a program duration or lifecycle rule.
        if (description != null && (description.length() > 10000 || description.indexOf('\0') >= 0)) {
            throw new InvalidProgramInput("description");
        }
        if (startDate == null || startDate.getYear() < 1 || startDate.getYear() > 9999) throw new InvalidProgramInput("startDate");
        if (endDate == null || endDate.getYear() < 1 || endDate.getYear() > 9999) throw new InvalidProgramInput("endDate");
        if (startDate.isAfter(endDate)) throw new InvalidProgramInput("startDate");
    }
    public String initialStatus() { return "DRAFT"; }
}
