package com.reflejatuinterior.organization.domain;

import static org.assertj.core.api.Assertions.*;
import com.reflejatuinterior.organization.InvalidOrganizationInput;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class NewOrganizationTest {
    @Test void normalizesTheNameAndStartsActiveWithoutAssumingColombia() {
        var draft = new NewOrganization("  Organización Real  ", "Europe/Madrid");
        assertThat(draft.name()).isEqualTo("Organización Real");
        assertThat(draft.defaultTimeZone()).isEqualTo("Europe/Madrid");
        assertThat(draft.initialStatus()).isEqualTo("ACTIVE");
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {" ", "\n", "Bad\tName"})
    void invalidNamesAreRejected(String name) {
        assertThatThrownBy(() -> new NewOrganization(name, "UTC")).isInstanceOf(InvalidOrganizationInput.class);
    }

    @Test void enforcesTheTechnicalNameLimit() {
        assertThatThrownBy(() -> new NewOrganization("x".repeat(256), "UTC")).isInstanceOf(InvalidOrganizationInput.class);
        assertThat(new NewOrganization("x".repeat(255), "UTC").name()).hasSize(255);
    }

    @ParameterizedTest @NullAndEmptySource @ValueSource(strings = {"Invalid/Zone", "+05:00", " America/Bogota"})
    void requiresANamedTimeZone(String zone) {
        assertThatThrownBy(() -> new NewOrganization("Name", zone)).isInstanceOf(InvalidOrganizationInput.class);
    }
}
