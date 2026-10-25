package com.reflejatuinterior.participation.domain;

import static org.assertj.core.api.Assertions.*;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class QuestionOptionsTests {
    @ParameterizedTest
    @EnumSource(value=EvaluationQuestionType.class,names={"SINGLE_CHOICE_LETTERS","SINGLE_CHOICE_WORDS"})
    void acceptsVariableCountsAndTrimsWithoutChangingOrder(EvaluationQuestionType type) {
        for (int size : new int[]{2,6,30,100}) {
            var options=IntStream.range(0,size).mapToObj(i->" Opción "+i+" ").toList();
            assertThat(QuestionOptions.clean(type,options)).containsExactlyElementsOf(options.stream().map(String::trim).toList());
        }
        assertThat(QuestionOptions.clean(type,List.of("1","5"))).containsExactly("1","5");
    }

    @ParameterizedTest
    @EnumSource(value=EvaluationQuestionType.class,names={"SINGLE_CHOICE_LETTERS","SINGLE_CHOICE_WORDS"})
    void rejectsMissingBlankDuplicateAndUnboundedOptions(EvaluationQuestionType type) {
        for (var options: List.of(List.<String>of(),List.of("Solo una"),List.of(" ","Dos"),
                List.of("Una"," una "),List.of("x".repeat(201),"Dos"),
                IntStream.range(0,101).mapToObj(i->"Opción "+i).toList())) {
            assertThatThrownBy(()->QuestionOptions.clean(type,options)).isInstanceOf(InvalidActivityEvaluation.class);
        }
        assertThatThrownBy(()->QuestionOptions.clean(type,null)).isInstanceOf(InvalidActivityEvaluation.class);
        assertThatThrownBy(()->QuestionOptions.clean(type,java.util.Arrays.asList(null,"Dos"))).isInstanceOf(InvalidActivityEvaluation.class);
    }

    @ParameterizedTest
    @EnumSource(value=EvaluationQuestionType.class,names={"SINGLE_CHOICE_LETTERS","SINGLE_CHOICE_WORDS"},mode=EnumSource.Mode.EXCLUDE)
    void fixedQuestionTypesDoNotAcceptCustomOptions(EvaluationQuestionType type) {
        assertThat(QuestionOptions.clean(type,null)).isEmpty();
        assertThatThrownBy(()->QuestionOptions.clean(type,List.of("Una","Dos"))).isInstanceOf(InvalidActivityEvaluation.class);
    }
}
