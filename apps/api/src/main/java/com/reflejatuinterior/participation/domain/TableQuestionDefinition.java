package com.reflejatuinterior.participation.domain;

import java.util.List;

/** Versioned layout stored with the question's options; answers follow row-major cell order. */
public record TableQuestionDefinition(String corner, List<String> columns, List<String> rows) {
    public int cellCount() { return rows.size() * columns.size(); }
    public String cellLabel(int position) {
        return rows.get(position / columns.size()) + " / " + columns.get(position % columns.size());
    }
    public static List<String> clean(List<String> input) {
        if (input == null || input.stream().anyMatch(v -> v == null || v.trim().isEmpty() || v.trim().length() > 200))
            throw new InvalidActivityEvaluation("options");
        var clean = input.stream().map(String::trim).toList();
        from(clean);
        return clean;
    }
    public static TableQuestionDefinition from(List<String> options) {
        if (options == null || options.isEmpty() || !options.getFirst().matches("TABLE_V1:([1-9]|1[0-9]|20):([1-9]|10)"))
            throw new InvalidActivityEvaluation("options");
        var size = options.getFirst().split(":");
        int rows = Integer.parseInt(size[1]), columns = Integer.parseInt(size[2]);
        if (options.size() != 2 + rows + columns) throw new InvalidActivityEvaluation("options");
        return new TableQuestionDefinition(options.get(1), List.copyOf(options.subList(2, 2 + columns)),
                List.copyOf(options.subList(2 + columns, options.size())));
    }
}
