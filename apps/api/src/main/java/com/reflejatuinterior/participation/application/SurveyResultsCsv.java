package com.reflejatuinterior.participation.application;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** One long-form CSV for filtered summaries, distributions and individual answers. */
public final class SurveyResultsCsv {
    private SurveyResultsCsv() {}
    public static byte[] render(SurveyResults report) {
        var csv = new StringBuilder("\uFEFF");
        for (var row : rows(report)) csv.append(row.stream().map(SurveyResultsCsv::cell).collect(java.util.stream.Collectors.joining(","))).append("\r\n");
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }
    static List<List<Object>> rows(SurveyResults report) {
        var rows = new ArrayList<List<Object>>();
        rows.add(Arrays.asList("Registro", "Programa ID", "Programa", "Dimensión", "Sesión", "Actividad", "Encuesta",
                "Participante", "Email", "Fecha UTC", "Pregunta", "Tipo pregunta", "Valor", "Respuesta",
                "Conteo", "Porcentaje", "Promedio", "Asignadas", "Respondidas", "Pendientes", "Base n"));
        summary(rows, report, "Resumen programa", "", "", "", report.summary());
        report.dimensions().forEach(c -> summary(rows, report, "Comparación dimensión", c.name(), "", "", c.summary()));
        report.sessions().forEach(c -> summary(rows, report, "Comparación sesión", c.context(), c.name(), "", c.summary()));
        report.surveys().forEach(s -> {
            var a = s.activity();
            summary(rows, report, "Comparación actividad", a.dimensionName(), a.sessionName(), a.title(), s.summary());
            for (var q : s.questions()) {
                if (q.average() != null) rows.add(row("Promedio pregunta", report.programId(), report.programName(), a.dimensionName(), a.sessionName(), a.title(), s.title(),
                        "", "", "", q.prompt(), q.type(), "", "", "", "", q.average(), "", "", "", q.responseCount()));
                for (var option : q.distribution()) rows.add(row("Distribución pregunta", report.programId(), report.programName(), a.dimensionName(), a.sessionName(), a.title(), s.title(),
                        "", "", "", q.prompt(), q.type(), option.value(), option.label(), option.count(), option.percentage(), "", "", "", "", q.responseCount()));
                for (var person : s.responses()) person.answers().stream().filter(answer -> answer.questionId().equals(q.id())).forEach(answer ->
                    answer.values().forEach(value -> rows.add(row("Respuesta", report.programId(), report.programName(), a.dimensionName(), a.sessionName(), a.title(), s.title(),
                            person.name(), person.email(), person.completedAt(), q.prompt(), q.type(), value, SurveyResultsService.label(q.type(), value),
                            "", "", "", "", "", "", ""))));
            }
        });
        return rows;
    }
    private static void summary(List<List<Object>> rows, SurveyResults report, String kind, String dimension, String session, String activity, SurveyResults.Summary summary) {
        rows.add(row(kind, report.programId(), report.programName(), dimension, session, activity, "", "", "", "", "", "", "", "",
                summary.responseCount(), summary.responseRate(), "", summary.assignedCount(), summary.responseCount(), summary.pendingCount(), summary.assignedCount()));
        rows.add(row(kind + " · Acuerdo", report.programId(), report.programName(), dimension, session, activity, "", "", "", "", "", "AGREEMENT_SCALE", "", "",
                "", "", summary.agreementAverage(), "", "", "", summary.agreementAnswers()));
        rows.add(row(kind + " · Probabilidad", report.programId(), report.programName(), dimension, session, activity, "", "", "", "", "", "LIKELIHOOD_SCALE", "", "",
                "", "", summary.likelihoodAverage(), "", "", "", summary.likelihoodAnswers()));
    }
    private static List<Object> row(Object... values) { return Arrays.asList(values); }
    static String cell(Object value) {
        String text = value == null ? "" : value.toString();
        // Quoting alone does not stop spreadsheet formulas. Preserve source data;
        // neutralize only the exported text, including whitespace-prefixed formulas.
        String start = text.stripLeading();
        if ((!start.isEmpty() && "=+-@".indexOf(start.charAt(0)) >= 0) || text.startsWith("\t") || text.startsWith("\r") || text.startsWith("\n"))
            text = "'" + text;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }
}
