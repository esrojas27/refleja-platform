package com.reflejatuinterior.participation.domain;

import static org.assertj.core.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class QuestionAnswersTests {
    @ParameterizedTest
    @EnumSource(value=EvaluationQuestionType.class,names={"SINGLE_CHOICE_LETTERS","SINGLE_CHOICE_WORDS"})
    void customChoiceAcceptsExactlyOneConfiguredLabel(EvaluationQuestionType type) {
        var options=List.of("Primera","Segunda");
        assertThat(QuestionAnswers.clean(type,options,List.of(" Segunda "))).containsExactly("Segunda");
        for(var values:List.of(List.<String>of(),List.of("1"),List.of("Otra"),List.of("segunda"),
                List.of("Primera","Segunda"),List.of("Primera","Primera"))) {
            assertThatThrownBy(()->QuestionAnswers.clean(type,options,values)).isInstanceOf(InvalidActivitySurveyResponse.class);
        }
        assertThatThrownBy(()->QuestionAnswers.clean(type,options,null)).isInstanceOf(InvalidActivitySurveyResponse.class);
    }
    @ParameterizedTest
    @EnumSource(value=EvaluationQuestionType.class,names={"AGREEMENT_SCALE","LIKELIHOOD_SCALE","NUMERIC_SCALE"})
    void scaleRulesRemainStrictAndSingleChoice(EvaluationQuestionType type) {
        assertThat(QuestionAnswers.clean(type,List.of(),List.of("5"))).containsExactly("5");
        for(var values:List.of(List.of("0"),List.of("6"),List.of("4.5"),List.of("1","2")))
            assertThatThrownBy(()->QuestionAnswers.clean(type,List.of(),values)).isInstanceOf(InvalidActivitySurveyResponse.class);
    }
    @Test void openAnswersAndTwoEmotionsKeepTheirExistingRules() {
        assertThat(QuestionAnswers.clean(EvaluationQuestionType.OPEN_TEXT,List.of(),List.of(" Mi experiencia "))).containsExactly("Mi experiencia");
        assertThat(QuestionAnswers.clean(EvaluationQuestionType.EMOTION_MULTI_SELECT,List.of(),List.of("Inspirado(a)","Reflexivo(a)"))).hasSize(2);
        assertThatThrownBy(()->QuestionAnswers.clean(EvaluationQuestionType.EMOTION_MULTI_SELECT,List.of(),List.of("Inspirado(a)","Reflexivo(a)","Retado(a)")))
                .isInstanceOf(InvalidActivitySurveyResponse.class);
    }
}
