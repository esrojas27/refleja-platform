package com.reflejatuinterior.participation.application;

import static org.assertj.core.api.Assertions.assertThat;
import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

class ProgramReportTest {
    private final UUID person = UUID.randomUUID();
    private final LocalDate today = LocalDate.of(2026, 10, 22);
    @Test void separatesSubmissionProgressFromApprovalAndCountsDueDatesOnce() {
        var work = List.of(work("SUBMITTED", 50, today.minusDays(1), true, true),
                work("COMPLETED", 100, today.minusDays(2), false, true),
                work("CHANGES_REQUESTED", 100, today, false, false), work("ASSIGNED", 0, today.plusDays(1), false, false));
        var summary = ProgramReportService.summarize(work, 2, today);
        assertThat(summary.progressPercentage()).isEqualTo(62.5);
        assertThat(summary.approvalPercentage()).isEqualTo(25);
        assertThat(summary.participationPercentage()).isEqualTo(50);
        assertThat(summary.participatingCount()).isEqualTo(1);
        assertThat(summary.pending()).isEqualTo(1);
        assertThat(summary.inReview()).isEqualTo(1);
        assertThat(summary.changesRequested()).isEqualTo(1);
        assertThat(summary.due()).isEqualTo(2);
        assertThat(summary.onTimePercentage()).isEqualTo(50);
        assertThat(summary.surveysAssigned()).isEqualTo(1);
        assertThat(summary.surveysCompleted()).isZero();
    }
    @Test void emptyDenominatorsAreNotFakeZeroScores() {
        var empty = ProgramReportService.summarize(List.of(), 0, today);
        assertThat(empty.progressPercentage()).isNull(); assertThat(empty.approvalPercentage()).isNull();
        assertThat(empty.participationPercentage()).isNull(); assertThat(empty.onTimePercentage()).isNull();
        assertThat(ProgramReportService.summarize(List.of(), 1, today).participationPercentage()).isZero();
    }
    @Test void exportsNumericCellsAndTreatsUntrustedTextAsTextInRealXlsx() throws Exception {
        var report = fixture();
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(ProgramReportExport.xlsx(report)))) {
            assertThat(book.getNumberOfSheets()).isEqualTo(4);
            var sheet = book.getSheet("Participación");
            assertThat(sheet.getPaneInformation().isFreezePane()).isTrue();
            assertThat(sheet.getRow(2).getCell(2).getStringCellValue()).isEqualTo("=1+1");
            assertThat(sheet.getRow(2).getCell(2).getCellType()).isEqualTo(CellType.STRING);
            assertThat(sheet.getRow(2).getCell(18).getCellType()).isEqualTo(CellType.NUMERIC);
            assertThat(sheet.getRow(2).getCell(18).getNumericCellValue()).isEqualTo(100);
            for (var tab : book) for (var row : tab) for (var cell : row) assertThat(cell.getCellType()).isNotEqualTo(CellType.FORMULA);
        }
    }
    @Test void csvUsesFixedColumnsEscapesFormulaAndPreservesOriginalData() {
        var report = fixture();
        var csv = new String(ProgramReportExport.csv(report), java.nio.charset.StandardCharsets.UTF_8);
        assertThat(csv).startsWith("\uFEFF\"Sección\"");
        assertThat(csv).contains("\"'=1+1\"", "\"Participación\"", "\"Actividades\"", "\r\n");
        assertThat(report.participants().getFirst().name()).isEqualTo("=1+1");
        var tables = ProgramReportExport.tables(report);
        tables.values().forEach(rows -> rows.forEach(row -> assertThat(row).hasSize(rows.getFirst().size())));
    }
    private ProgramReport fixture() {
        var work = List.of(work("SUBMITTED", 100, today.minusDays(1), false, true));
        var summary = ProgramReportService.summarize(work, 1, today);
        var surveys = new SurveyResults(person, "Programa", Instant.now(), new SurveyResults.Scope(null, null, null), List.of(),
                new SurveyResults.Summary(0, 0, 0, 0, 0, 0, null, null, 0, null, 0), List.of(), List.of(), List.of(), List.of());
        return new ProgramReport(person, "Empresa", person, "Programa", "ACTIVE", today, today, Instant.now(), "America/Bogota", today,
                person, summary, Map.of("ACTIVE", 1L), List.of(new ProgramReport.Participant(person, "=1+1", "ana@example.test", "ACTIVE", summary)), work, surveys);
    }
    private ProgramReport.Work work(String status, int progress, LocalDate due, boolean survey, boolean onTime) {
        return new ProgramReport.Work(UUID.randomUUID(), person, UUID.randomUUID(), "Reflexión", UUID.randomUUID(), "Interior", UUID.randomUUID(), "Sesión",
                due, status, progress == 0 ? null : Instant.now(), survey, null, progress, !status.equals("COMPLETED") && due.isBefore(today), onTime && progress == 100, progress);
    }
}
