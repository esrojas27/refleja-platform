package com.reflejatuinterior.program.application;

import java.util.List;

public record ProgramPage(List<ProgramData> items, int page, int size, long totalElements, int totalPages) {
    public ProgramPage { items = List.copyOf(items); }
}
