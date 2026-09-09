package com.reflejatuinterior.program.domain;

import static org.assertj.core.api.Assertions.*;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class NewProgramTest {
    private final LocalDate day = LocalDate.of(2026, 9, 1);

    @Test void trimsNameAllowsEqualDatesAndAlwaysDraft() {
        var program = new NewProgram("  Programa  ", null, day, day);
        assertThat(program.name()).isEqualTo("Programa");
        assertThat(program.initialStatus()).isEqualTo("DRAFT");
    }
    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {" ", "bad\nname"})
    void rejectsInvalidName(String name) { assertThatThrownBy(() -> new NewProgram(name, null, day, day)).isInstanceOf(InvalidProgramInput.class); }
    @Test void enforcesNameAndDescriptionLimits() {
        assertThatThrownBy(() -> new NewProgram("x".repeat(256), null, day, day)).isInstanceOf(InvalidProgramInput.class);
        assertThatThrownBy(() -> new NewProgram("ok", "x".repeat(10001), day, day)).isInstanceOf(InvalidProgramInput.class);
        assertThatThrownBy(() -> new NewProgram("ok", "bad\0text", day, day)).isInstanceOf(InvalidProgramInput.class);
    }
    @Test void rejectsMissingReversedOrNonIsoYearDates() {
        assertThatThrownBy(() -> new NewProgram("ok", null, null, day)).isInstanceOf(InvalidProgramInput.class);
        assertThatThrownBy(() -> new NewProgram("ok", null, day, null)).isInstanceOf(InvalidProgramInput.class);
        assertThatThrownBy(() -> new NewProgram("ok", null, day.plusDays(1), day)).isInstanceOf(InvalidProgramInput.class);
        assertThatThrownBy(() -> new NewProgram("ok", null, day.withYear(0), day)).isInstanceOf(InvalidProgramInput.class);
    }
}
