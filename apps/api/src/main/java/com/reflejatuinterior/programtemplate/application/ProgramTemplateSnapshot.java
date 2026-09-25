package com.reflejatuinterior.programtemplate.application;

import java.util.List;

public record ProgramTemplateSnapshot(String sourceName, String sourceDescription, long durationDays,
                                      List<Dimension> dimensions) {
    public ProgramTemplateSnapshot { dimensions = List.copyOf(dimensions); }

    public record Dimension(String name, String description, int position, List<Session> sessions) {
        public Dimension { sessions = List.copyOf(sessions); }
    }

    public record Session(String name, String description, String objective, long scheduledDayOffset,
                          int position, List<Activity> activities) {
        public Session { activities = List.copyOf(activities); }
    }

    public record Activity(String reference, String title, String instructions, String youtubeUrl,
                           long dueDayOffset, int position, Survey survey) {}

    public record Survey(String title, String instructions, List<Question> questions) {
        public Survey { questions = List.copyOf(questions); }
    }

    public record Question(String prompt, String type, int position) {}
}
