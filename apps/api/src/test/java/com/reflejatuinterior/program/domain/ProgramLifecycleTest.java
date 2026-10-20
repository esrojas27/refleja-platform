package com.reflejatuinterior.program.domain;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ProgramLifecycleTest {
    @ParameterizedTest
    @CsvSource({"DRAFT,ACTIVE", "DRAFT,CANCELLED", "SCHEDULED,ACTIVE", "SCHEDULED,CANCELLED",
            "ACTIVE,COMPLETED", "ACTIVE,CANCELLED"})
    void permitsOnlyForwardManualTransitions(String current, String target) {
        assertThat(ProgramLifecycle.canTransition(current, target)).isTrue();
    }

    @ParameterizedTest
    @CsvSource({"DRAFT,COMPLETED", "DRAFT,DRAFT", "DRAFT,SCHEDULED", "ACTIVE,DRAFT", "ACTIVE,ACTIVE",
            "ACTIVE,SCHEDULED", "COMPLETED,ACTIVE", "COMPLETED,CANCELLED", "COMPLETED,COMPLETED",
            "CANCELLED,ACTIVE", "CANCELLED,DRAFT", "CANCELLED,COMPLETED"})
    void rejectsInvalidTransitions(String current, String target) {
        assertThat(ProgramLifecycle.canTransition(current, target)).isFalse();
    }
}
