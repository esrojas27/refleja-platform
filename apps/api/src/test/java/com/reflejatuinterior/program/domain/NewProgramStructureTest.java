package com.reflejatuinterior.program.domain;

import static org.assertj.core.api.Assertions.*;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class NewProgramStructureTest {
    @Test void normalizesValidNamesAndKeepsApprovedFields() {
        var module = new NewProgramModule("  Fundamentos  ", "Contexto", 1);
        var session = new NewProgramSession("  Sesión inicial  ", null, LocalDate.of(2026, 10, 1), 2);
        assertThat(module.name()).isEqualTo("Fundamentos");
        assertThat(module.position()).isEqualTo(1);
        assertThat(session.name()).isEqualTo("Sesión inicial");
        assertThat(session.scheduledDate()).isEqualTo(LocalDate.of(2026, 10, 1));
    }

    @Test void rejectsMissingNamesDatesAndNonPositivePositions() {
        assertThatThrownBy(() -> new NewProgramModule(" ", null, 1)).isInstanceOf(InvalidProgramInput.class);
        assertThatThrownBy(() -> new NewProgramModule("Módulo", null, 0)).isInstanceOf(InvalidProgramInput.class);
        assertThatThrownBy(() -> new NewProgramSession("Sesión", null, null, 1)).isInstanceOf(InvalidProgramInput.class);
        assertThatThrownBy(() -> new NewProgramSession("Sesión", null, LocalDate.now(), -1)).isInstanceOf(InvalidProgramInput.class);
    }
}
