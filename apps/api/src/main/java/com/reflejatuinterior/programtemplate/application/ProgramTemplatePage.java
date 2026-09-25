package com.reflejatuinterior.programtemplate.application;

import java.util.List;

public record ProgramTemplatePage(List<ProgramTemplateData> items, int page, int size,
                                  long totalElements, int totalPages) {
    public ProgramTemplatePage { items = List.copyOf(items); }
}
