package com.reflejatuinterior.program.domain;

import java.time.LocalDate;

public record NewProgramActivity(String title, String instructions, LocalDate dueDate, int position) {
    public NewProgramActivity {
        if (title == null || title.isBlank() || title.length() > 255
                || title.codePoints().anyMatch(Character::isISOControl)) {
            throw new InvalidProgramInput("title");
        }
        title = title.strip();
        if (instructions == null || instructions.isBlank() || instructions.length() > 10000
                || instructions.indexOf('\0') >= 0) {
            throw new InvalidProgramInput("instructions");
        }
        instructions = instructions.strip();
        if (dueDate == null || dueDate.getYear() < 1 || dueDate.getYear() > 9999) {
            throw new InvalidProgramInput("dueDate");
        }
        if (position < 1) throw new InvalidProgramInput("position");
    }
}
