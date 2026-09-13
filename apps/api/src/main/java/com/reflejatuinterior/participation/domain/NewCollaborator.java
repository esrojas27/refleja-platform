package com.reflejatuinterior.participation.domain;

import java.util.Locale;
import java.util.regex.Pattern;

/** Contact input, never a substitute for the Cognito subject as technical identity. */
public record NewCollaborator(String email, String firstName, String lastName) {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    public NewCollaborator {
        email = required(email, "email", 254).toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(email).matches()) throw new InvalidEnrollmentInput("email");
        firstName = required(firstName, "firstName", 100);
        lastName = required(lastName, "lastName", 100);
    }

    private static String required(String value, String field, int max) {
        if (value == null || value.isBlank()) throw new InvalidEnrollmentInput(field);
        String normalized = value.strip();
        if (normalized.length() > max || normalized.codePoints().anyMatch(Character::isISOControl)) {
            throw new InvalidEnrollmentInput(field);
        }
        return normalized;
    }
}
