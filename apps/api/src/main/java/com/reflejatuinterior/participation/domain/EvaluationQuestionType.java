package com.reflejatuinterior.participation.domain;

public enum EvaluationQuestionType {
    AGREEMENT_SCALE,
    LIKELIHOOD_SCALE,
    NUMERIC_SCALE,
    OPEN_TEXT,
    EMOTION_MULTI_SELECT,
    SINGLE_CHOICE_LETTERS,
    SINGLE_CHOICE_WORDS,
    MULTIPLE_CHOICE_WORDS,
    IMAGE,
    TABLE;

    public boolean activityOnly() {
        return this == MULTIPLE_CHOICE_WORDS || this == IMAGE;
    }

    public boolean hasCustomOptions() {
        return this == SINGLE_CHOICE_LETTERS || this == SINGLE_CHOICE_WORDS || this == MULTIPLE_CHOICE_WORDS;
    }
}
