package com.reflejatuinterior.participation.domain;

import static org.assertj.core.api.Assertions.*;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

class TableQuestionTests {
    private static final List<String> OPTIONS = List.of("TABLE_V1:2:2", "Ámbito", "Acción", "Avance", "Personal", "Social");
    @Test void keepsRowMajorOrderAndAllowsRepeatedCellText() {
        assertThat(QuestionAnswers.clean(EvaluationQuestionType.TABLE, OPTIONS, List.of(" Uno ", "Igual", "Igual", "Cuatro")))
            .containsExactly("Uno", "Igual", "Igual", "Cuatro");
        assertThat(TableQuestionDefinition.from(OPTIONS).cellLabel(2)).isEqualTo("Social / Acción");
        assertThat(QuestionOptions.clean(EvaluationQuestionType.TABLE, OPTIONS)).isEqualTo(OPTIONS);
    }
    @Test void requiresEveryCellAndEnforcesTheCellLimit() {
        for (var values : List.of(List.<String>of(), List.of("Uno"), List.of("Uno","Dos"," ","Cuatro"),
                List.of("Uno","Dos","Tres","x".repeat(151)), List.of("1","2","3","4","5"))) {
            assertThatThrownBy(() -> QuestionAnswers.clean(EvaluationQuestionType.TABLE, OPTIONS, values))
                .isInstanceOf(InvalidActivitySurveyResponse.class);
        }
        assertThat(QuestionAnswers.clean(EvaluationQuestionType.TABLE, OPTIONS, Collections.nCopies(4, "x".repeat(150)))).hasSize(4);
    }
    @Test void supportsTheMaximumTableAndRejectsMalformedLayouts() {
        var max = new ArrayList<String>(List.of("TABLE_V1:20:10", "Ámbito"));
        max.addAll(Collections.nCopies(10,"Columna")); max.addAll(Collections.nCopies(20,"Fila"));
        assertThat(QuestionOptions.clean(EvaluationQuestionType.TABLE, max)).hasSize(32);
        assertThat(QuestionAnswers.clean(EvaluationQuestionType.TABLE, max, Collections.nCopies(200,"Respuesta"))).hasSize(200);
        for (var options : List.of(List.<String>of(), List.of("TABLE_V1:21:1","Ámbito","Columna","Fila"),
                List.of("TABLE_V1:1:11","Ámbito","Columna","Fila"), List.of("TABLE_V1:0:1","Ámbito","Columna"),
                List.of("TABLE_V1:1:1","Ámbito","Columna"), List.of("TABLE_V1:1:1","Ámbito","Columna"," "),
                List.of("TABLE_V1:1:1","Ámbito","Columna","x".repeat(201)))) {
            assertThatThrownBy(() -> QuestionOptions.clean(EvaluationQuestionType.TABLE, options)).isInstanceOf(InvalidActivityEvaluation.class);
        }
    }
}
