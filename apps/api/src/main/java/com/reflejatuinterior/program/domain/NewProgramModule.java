package com.reflejatuinterior.program.domain;

public record NewProgramModule(String name, String description, int position) {
    public NewProgramModule {
        if (name == null || name.isBlank() || name.length() > 255
                || name.codePoints().anyMatch(Character::isISOControl)) {
            throw new InvalidProgramInput("name");
        }
        name = name.strip();
        if (description != null && (description.length() > 10000 || description.indexOf('\0') >= 0)) {
            throw new InvalidProgramInput("description");
        }
        if (position < 1) throw new InvalidProgramInput("position");
    }
}
