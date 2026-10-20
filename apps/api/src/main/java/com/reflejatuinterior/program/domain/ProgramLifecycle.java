package com.reflejatuinterior.program.domain;

/** Explicit lifecycle; dates never change a program's state implicitly. */
public final class ProgramLifecycle {
    private ProgramLifecycle() {}

    public static boolean canTransition(String current, String target) {
        return switch (current) {
            case "DRAFT" -> "ACTIVE".equals(target) || "CANCELLED".equals(target);
            case "SCHEDULED" -> "ACTIVE".equals(target) || "CANCELLED".equals(target);
            case "ACTIVE" -> "COMPLETED".equals(target) || "CANCELLED".equals(target);
            default -> false;
        };
    }
}
