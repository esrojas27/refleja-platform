package com.reflejatuinterior.participation.domain;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Answer rules independent of whether the containing form belongs to an activity or session. */
public final class QuestionAnswers {
    private QuestionAnswers() {}
    public static List<String> clean(EvaluationQuestionType type, List<String> options, List<String> input) {
        var values=input==null?List.<String>of():input.stream().map(v->v==null?"":v.trim()).toList();
        if (type==null || new LinkedHashSet<>(values).size()!=values.size() || values.stream().anyMatch(String::isEmpty)) invalid();
        if (type==EvaluationQuestionType.OPEN_TEXT) {
            if (values.size()!=1 || values.getFirst().length()>5000) invalid();
        } else if (type==EvaluationQuestionType.EMOTION_MULTI_SELECT) {
            if (values.isEmpty() || values.size()>2 || !EMOTIONS.containsAll(values)) invalid();
        } else if (type.hasCustomOptions()) {
            if (values.size()!=1 || options==null || !options.contains(values.getFirst())) invalid();
        } else if (values.size()!=1 || !SCALE_VALUES.contains(values.getFirst())) invalid();
        return values;
    }
    private static void invalid() { throw new InvalidActivitySurveyResponse("answers"); }
    private static final Set<String> SCALE_VALUES=Set.of("1","2","3","4","5");
    private static final Set<String> EMOTIONS=Set.of("Inspirado(a)","Motivado(a)","Reflexivo(a)",
            "Sorprendido(a)","Retado(a)","Confundido(a)","Indiferente");
}
