package com.reflejatuinterior.participation.application;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class SurveyResultsCsvTest {
    @Test void quotesSeparatorsQuotesNewlinesAndSpanishText() {
        assertThat(SurveyResultsCsv.cell("Reflexión, \"interior\"\r\nNueva línea"))
                .isEqualTo("\"Reflexión, \"\"interior\"\"\r\nNueva línea\"");
        assertThat(SurveyResultsCsv.cell(null)).isEqualTo("\"\"");
        assertThat(SurveyResultsCsv.cell(3.5)).isEqualTo("\"3.5\"");
    }
    @Test void neutralizesFormulasIncludingWhitespaceAndControlPrefixes() {
        for (String value : java.util.List.of("=1+1", "+SUM(A1)", "-1+1", "@SUM(A1)", "   =1+1", "\t=1+1", "\r=1+1", "\n=1+1"))
            assertThat(SurveyResultsCsv.cell(value)).startsWith("\"'");
        assertThat(SurveyResultsCsv.cell("Aprendí a escuchar")).isEqualTo("\"Aprendí a escuchar\"");
    }
}
