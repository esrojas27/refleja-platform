package com.reflejatuinterior.program.domain;

import java.time.LocalDate;

public record NewProgramSession(String name, String description, String objective,
        LocalDate scheduledDate, int position) {
    public NewProgramSession {
        if (name == null || name.isBlank() || name.length() > 255
                || name.codePoints().anyMatch(Character::isISOControl)) {
            throw new InvalidProgramInput("name");
        }
        name = name.strip();
        if (description != null && (description.length() > 10000 || description.indexOf('\0') >= 0)) {
            throw new InvalidProgramInput("description");
        }
        if (objective != null && (objective.length() > 10000 || objective.indexOf('\0') >= 0)) {
            throw new InvalidProgramInput("objective");
        }
        description = normalize(description);
        objective = normalize(objective);
        if (objective == null) objective = description;
        if (scheduledDate == null || scheduledDate.getYear() < 1 || scheduledDate.getYear() > 9999) {
            throw new InvalidProgramInput("scheduledDate");
        }
        if (position < 1) throw new InvalidProgramInput("position");
    }

    private static String normalize(String value) {
        if (value == null || value.isBlank()) return null;
        return value.strip();
    }
}
