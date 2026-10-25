package com.reflejatuinterior.participation.domain;

public enum EvaluationQuestionType {
    AGREEMENT_SCALE,
    LIKELIHOOD_SCALE,
    NUMERIC_SCALE,
    OPEN_TEXT,
    EMOTION_MULTI_SELECT,
    SINGLE_CHOICE_LETTERS,
    SINGLE_CHOICE_WORDS;

    public boolean hasCustomOptions() {
        return this == SINGLE_CHOICE_LETTERS || this == SINGLE_CHOICE_WORDS;
    }
}
