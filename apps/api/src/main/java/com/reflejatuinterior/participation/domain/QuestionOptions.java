package com.reflejatuinterior.participation.domain;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;

/** Definition rules shared by activity forms and future session forms. */
public final class QuestionOptions {
    public static final int MAX_OPTIONS = 100;
    public static final int MAX_OPTION_LENGTH = 200;
    private QuestionOptions() {}

    public static List<String> clean(EvaluationQuestionType type, List<String> input) {
        var options = input == null ? List.<String>of() : input;
        if (type == null) throw new InvalidActivityEvaluation("type");
        if (!type.hasCustomOptions()) {
            if (!options.isEmpty()) throw new InvalidActivityEvaluation("options");
            return List.of();
        }
        if (options.size() < 2 || options.size() > MAX_OPTIONS) throw new InvalidActivityEvaluation("options");
        var cleaned = options.stream().map(value -> value == null ? "" : value.trim()).toList();
        var seen = new HashSet<String>();
        for (var value : cleaned) {
            if (value.isEmpty() || value.length() > MAX_OPTION_LENGTH || !seen.add(value.toLowerCase(Locale.ROOT)))
                throw new InvalidActivityEvaluation("options");
        }
        return cleaned;
    }
}
