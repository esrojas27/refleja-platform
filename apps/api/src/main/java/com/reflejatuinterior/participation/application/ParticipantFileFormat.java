package com.reflejatuinterior.participation.application;

import java.nio.charset.StandardCharsets;
import com.reflejatuinterior.participation.domain.InvalidActivitySurveyResponse;

public final class ParticipantFileFormat {
    static final int MAX_BYTES = 10 * 1024 * 1024;
    private ParticipantFileFormat() {}
    static String type(byte[] bytes) {
        if (bytes == null || bytes.length == 0 || bytes.length > MAX_BYTES) throw new Invalid("file");
        if (bytes.length >= 16) {
            var header = new String(bytes, 0, 8, StandardCharsets.US_ASCII);
            var tail = new String(bytes, Math.max(0, bytes.length - 1024), Math.min(1024, bytes.length), StandardCharsets.US_ASCII);
            if ((header.matches("%PDF-1\\.[0-7]") || header.equals("%PDF-2.0")) && tail.contains("%%EOF")) return "application/pdf";
        }
        try { return ActivityImageFormat.validate(bytes).contentType(); }
        catch (InvalidActivitySurveyResponse invalid) { throw new Invalid("file"); }
    }
    static String title(String input) {
        if (input == null) throw new Invalid("name");
        String value = input.strip();
        if (value.isEmpty() || value.length() > 160 || value.codePoints().anyMatch(Character::isISOControl)) throw new Invalid("name");
        return value;
    }
    public static class Invalid extends RuntimeException {
        private final String field;
        Invalid(String field) { this.field = field; }
        public String field() { return field; }
    }
}
