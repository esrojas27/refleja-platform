package com.reflejatuinterior;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

class ApplicationModulesTest {

    private static final Set<String> EXPECTED_MODULES = Set.of(
            "identity",
            "organization",
            "program",
            "programtemplate",
            "participation");

    @Test
    void verifiesApplicationModuleBoundaries() {
        ApplicationModules.of(ReflejaTuInteriorApplication.class).verify();
    }

    @Test
    void discoversExactlyTheInitialModules() {
        var moduleIdentifiers = ApplicationModules.of(ReflejaTuInteriorApplication.class)
                .stream()
                .map(module -> module.getIdentifier().toString())
                .collect(java.util.stream.Collectors.toSet());

        assertThat(moduleIdentifiers).isEqualTo(EXPECTED_MODULES);
    }
}
