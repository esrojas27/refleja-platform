package com.reflejatuinterior.participation.application;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/** Both exports use identical tables; no server-side files or executable spreadsheet formulas. */
public final class ProgramReportExport {
    private ProgramReportExport() {}

    public static byte[] csv(ProgramReport report) {
        var tables = tables(report);
        var columns = new ArrayList<String>();
        columns.add("Sección");
        tables.values().forEach(rows -> rows.getFirst().forEach(h -> { if (!columns.contains(h.toString())) columns.add(h.toString()); }));
        var csv = new StringBuilder("\uFEFF");
        append(csv, new ArrayList<>(columns));
        tables.forEach((section, rows) -> {
            var headers = rows.getFirst();
            for (var values : rows.subList(1, rows.size())) {
                var row = new ArrayList<Object>(java.util.Collections.nCopies(columns.size(), null));
                row.set(0, section);
                for (int col = 0; col < values.size(); col++) row.set(columns.indexOf(headers.get(col).toString()), values.get(col));
                append(csv, row);
            }
        });
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }
    private static void append(StringBuilder csv, List<Object> row) {
        csv.append(row.stream().map(SurveyResultsCsv::cell).collect(Collectors.joining(","))).append("\r\n");
    }

    public static byte[] xlsx(ProgramReport report) {
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var headerStyle = workbook.createCellStyle();
            headerStyle.setFillForegroundColor(IndexedColors.GREY_80_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            var font = workbook.createFont(); font.setBold(true); font.setColor(IndexedColors.WHITE.getIndex()); headerStyle.setFont(font);
            var bodyStyle = workbook.createCellStyle(); bodyStyle.setWrapText(true);
            bodyStyle.setVerticalAlignment(org.apache.poi.ss.usermodel.VerticalAlignment.TOP);
            var numericStyle = workbook.createCellStyle(); numericStyle.setDataFormat(workbook.createDataFormat().getFormat("0.##"));
            tables(report).forEach((name, rows) -> {
                var sheet = workbook.createSheet(name);
                if (rows.size() > 1_048_576) throw new com.reflejatuinterior.program.ProgramActivities.InvalidInput("reportSize");
                for (int r = 0; r < rows.size(); r++) {
                    var row = sheet.createRow(r);
                    for (int c = 0; c < rows.get(r).size(); c++) {
                        var cell = row.createCell(c); var value = rows.get(r).get(c);
                        if (value instanceof Number number) { cell.setCellValue(number.doubleValue()); cell.setCellStyle(numericStyle); }
                        else if (value != null) {
                            String text = value.toString();
                            if (text.length() > 32767) throw new com.reflejatuinterior.program.ProgramActivities.InvalidInput("reportSize");
                            cell.setCellValue(text); cell.setCellStyle(bodyStyle);
                        }
                        if (r == 0) cell.setCellStyle(headerStyle);
                    }
                    if (r == 0) row.setHeightInPoints(32);
                }
                sheet.createFreezePane(0, 1);
                sheet.setAutoFilter(new CellRangeAddress(0, rows.size() - 1, 0, rows.getFirst().size() - 1));
                for (int c = 0; c < rows.getFirst().size(); c++) sheet.setColumnWidth(c, (name.equals("Ficha") ? (c == 0 ? 30 : 90) : 24) * 256);
            });
            workbook.write(output); return output.toByteArray();
        } catch (IOException e) { throw new UncheckedIOException(e); }
    }

    static Map<String, List<List<Object>>> tables(ProgramReport r) {
        var tables = new LinkedHashMap<String, List<List<Object>>>();
        var info = new ArrayList<List<Object>>(); info.add(row("Dato", "Detalle"));
        info.add(row("Organización", r.organizationName())); info.add(row("Organización ID", r.organizationId()));
        info.add(row("Programa", r.programName())); info.add(row("Programa ID", r.programId()));
        info.add(row("Estado del programa", programStatus(r.programStatus())));
        info.add(row("Inicio", r.startDate())); info.add(row("Fin", r.endDate()));
        info.add(row("Generado UTC", r.generatedAt())); info.add(row("Fecha de corte", r.asOfDate())); info.add(row("Zona horaria", r.timeZone()));
        info.add(row("Alcance", r.enrollmentId() == null ? "Programa completo" : "Individual: " + r.enrollmentId()));
        info.add(row("Avance", "Promedio por sesión y participante: formularios de actividades 80% y encuesta de cierre 20%. No equivale a aprobación."));
        info.add(row("Aprobación", "Asignaciones aprobadas por el consultor / todas las asignaciones vigentes."));
        info.add(row("Participación", "Personas con al menos una entrega / todas las inscripciones del alcance, incluidas invitadas, suspendidas y retiradas."));
        info.add(row("Cumplimiento de fecha", "Asignaciones cuyo plazo ya terminó, con última entrega y encuesta (si aplica) enviadas dentro de la fecha límite / asignaciones cuyo plazo ya terminó. No mide la primera entrega ni la fecha de aprobación."));
        info.add(row("Vencidas", "Plazo anterior al corte y aún sin aprobación. Puede incluir trabajo enviado en revisión."));
        info.add(row("Comparaciones", "Medias descriptivas por tipo de escala; no son puntajes ni evaluaciones inicial/final. Las preguntas pueden medir cosas distintas."));
        info.add(row("Base", "Sin denominador se deja la celda vacía. Contenido archivado excluido. Datos y fechas límite actuales, no reconstrucción histórica."));
        info.add(row("Privacidad", "Contiene nombres, correos y respuestas de encuestas. Compartir solo con personas autorizadas. No incluye DISC ni textos de entregas."));
        tables.put("Ficha", info);
        var participation = new ArrayList<List<Object>>();
        participation.add(row("Registro", "Participante ID", "Participante", "Email", "Inscripción", "Personas", "Personas con entregas",
                "Asignadas", "Enviadas", "Pendientes", "En revisión", "Requiere cambios", "Aprobadas", "Vencidas",
                "Encuestas asignadas", "Encuestas respondidas", "Plazos terminados", "A tiempo", "Avance %", "Aprobación %", "Participación %", "Cumplimiento fecha %"));
        participation.add(summaryRow("Total", null, null, null, null, r.summary()));
        r.participants().forEach(p -> participation.add(summaryRow("Participante", p.enrollmentId(), p.name(), p.email(), enrollmentStatus(p.status()), p.summary())));
        tables.put("Participación", participation);
        var work = new ArrayList<List<Object>>();
        work.add(row("Asignación ID", "Participante ID", "Participante", "Email", "Actividad ID", "Dimensión", "Sesión", "Actividad",
                "Estado actividad", "Fecha límite", "Última entrega UTC", "Encuesta requerida", "Encuesta enviada UTC", "Avance %", "Vencida", "Enviada a tiempo"));
        var people = r.participants().stream().collect(Collectors.toMap(ProgramReport.Participant::enrollmentId, p -> p));
        r.work().forEach(w -> {
            var p = people.get(w.enrollmentId());
            work.add(row(w.assignmentId(), w.enrollmentId(), p.name(), p.email(), w.activityId(), w.dimensionName(), w.sessionName(), w.activityTitle(),
                    activityStatus(w.status()), w.dueDate(), w.submittedAt(), w.surveyRequired() ? "Sí" : "No", w.surveyCompletedAt(), w.progressPercentage(),
                    w.overdue() ? "Sí" : "No", w.onTime() ? "Sí" : "No"));
        });
        tables.put("Actividades", work);
        tables.put("Encuestas", SurveyResultsCsv.rows(r.surveys()));
        return tables;
    }
    private static List<Object> summaryRow(String type, Object id, String name, String email, String status, ProgramReport.Summary s) {
        return row(type, id, name, email, status, s.participantCount(), s.participatingCount(), s.assigned(), s.submitted(), s.pending(), s.inReview(),
                s.changesRequested(), s.approved(), s.overdue(), s.surveysAssigned(), s.surveysCompleted(), s.due(), s.onTime(),
                s.progressPercentage(), s.approvalPercentage(), s.participationPercentage(), s.onTimePercentage());
    }
    private static List<Object> row(Object... values) { return Arrays.asList(values); }
    static String enrollmentStatus(String status) { return switch (status) {
        case "ACTIVE" -> "Activa"; case "INVITED" -> "Invitada"; case "SUSPENDED" -> "Suspendida";
        case "COMPLETED" -> "Completada"; case "WITHDRAWN" -> "Retirada"; default -> "Pendiente de aprobación";
    }; }
    static String programStatus(String status) { return switch (status) {
        case "ACTIVE" -> "Activo"; case "COMPLETED" -> "Finalizado"; case "CANCELLED" -> "Cancelado"; case "SCHEDULED" -> "Programado"; default -> "Borrador";
    }; }
    static String activityStatus(String status) { return switch (status) {
        case "SUBMITTED" -> "En revisión"; case "CHANGES_REQUESTED" -> "Requiere cambios"; case "COMPLETED" -> "Completada"; default -> "Pendiente";
    }; }
}
