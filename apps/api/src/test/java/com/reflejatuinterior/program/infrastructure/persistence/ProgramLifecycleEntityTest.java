package com.reflejatuinterior.program.infrastructure.persistence;

import static org.assertj.core.api.Assertions.*;
import java.time.LocalDate;
import java.util.UUID;
import com.reflejatuinterior.program.ProgramDirectory;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class ProgramLifecycleEntityTest {
    @Test void refusesAnOutdatedVersionWithoutChangingTheState() {
        var program = draft();
        ReflectionTestUtils.setField(program, "version", 2L);
        assertThatThrownBy(() -> program.transitionTo(ProgramStatus.ACTIVE, 1))
                .isInstanceOfSatisfying(ProgramDirectory.StateConflict.class,
                        error -> assertThat(error.code()).isEqualTo("PROGRAM_VERSION_CONFLICT"));
        assertThat(program.status()).isEqualTo(ProgramStatus.DRAFT);
    }

    @Test void terminalStateCannotBeReopenedAndDoesNotChangeOtherMetadata() {
        var program = draft();
        program.transitionTo(ProgramStatus.ACTIVE, 0);
        program.transitionTo(ProgramStatus.COMPLETED, 0);
        assertThatThrownBy(() -> program.transitionTo(ProgramStatus.ACTIVE, 0))
                .isInstanceOf(ProgramDirectory.StateConflict.class);
        assertThat(program.status()).isEqualTo(ProgramStatus.COMPLETED);
        assertThat(program.name()).isEqualTo("Programa");
        assertThat(program.endDate()).isEqualTo(LocalDate.of(2027, 2, 1));
        assertThat(program.activated()).isTrue();
    }

    @Test void cancellingADraftNeverPublishesItsContent() {
        var program = draft();
        program.transitionTo(ProgramStatus.CANCELLED, 0);
        assertThat(program.activated()).isFalse();
    }

    private ProgramJpaEntity draft() {
        return new ProgramJpaEntity(UUID.randomUUID(), "Programa", "Descripción", ProgramStatus.DRAFT,
                LocalDate.of(2027, 1, 1), LocalDate.of(2027, 2, 1), null);
    }
}
