package com.reflejatuinterior.program.domain;

import static org.assertj.core.api.Assertions.*;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class NewProgramStructureTest {
    @Test void normalizesValidNamesAndKeepsApprovedFields() {
        var module = new NewProgramModule("  Fundamentos  ", "Contexto", 1);
        var session = new NewProgramSession("  Sesión inicial  ", null, "  Definir el punto de partida  ",
                LocalDate.of(2026, 10, 1), 2);
        assertThat(module.name()).isEqualTo("Fundamentos");
        assertThat(module.position()).isEqualTo(1);
        assertThat(session.name()).isEqualTo("Sesión inicial");
        assertThat(session.objective()).isEqualTo("Definir el punto de partida");
        assertThat(session.scheduledDate()).isEqualTo(LocalDate.of(2026, 10, 1));
    }

    @Test void rejectsMissingNamesDatesAndNonPositivePositions() {
        assertThatThrownBy(() -> new NewProgramModule(" ", null, 1)).isInstanceOf(InvalidProgramInput.class);
        assertThatThrownBy(() -> new NewProgramModule("Módulo", null, 0)).isInstanceOf(InvalidProgramInput.class);
        assertThatThrownBy(() -> new NewProgramSession("Sesión", null, null, null, 1)).isInstanceOf(InvalidProgramInput.class);
        assertThatThrownBy(() -> new NewProgramSession("Sesión", null, null, LocalDate.now(), -1)).isInstanceOf(InvalidProgramInput.class);
    }

    @Test void keepsTheLegacySessionDescriptionAsAnObjectiveForCompatibility() {
        var session = new NewProgramSession("Sesión", "Descripción anterior", null,
                LocalDate.of(2026, 10, 1), 1);
        assertThat(session.description()).isEqualTo("Descripción anterior");
        assertThat(session.objective()).isEqualTo("Descripción anterior");
    }

    @Test void validatesOptionalYoutubeVideoLinks() {
        var activity = new NewProgramActivity("Reflexión", "Responde", " https://youtu.be/dQw4w9WgXcQ ",
                LocalDate.of(2026, 10, 8), 1);
        assertThat(activity.youtubeUrl()).isEqualTo("https://youtu.be/dQw4w9WgXcQ");
        assertThat(new NewProgramActivity("Reflexión", "Responde", null,
                LocalDate.of(2026, 10, 8), 1).youtubeUrl()).isNull();
        assertThatThrownBy(() -> new NewProgramActivity("Reflexión", "Responde",
                "http://youtube.com/watch?v=dQw4w9WgXcQ", LocalDate.of(2026, 10, 8), 1))
                .isInstanceOf(InvalidProgramInput.class).extracting("field").isEqualTo("youtubeUrl");
        assertThatThrownBy(() -> new NewProgramActivity("Reflexión", "Responde",
                "https://example.com/watch?v=dQw4w9WgXcQ", LocalDate.of(2026, 10, 8), 1))
                .isInstanceOf(InvalidProgramInput.class);
    }
}
