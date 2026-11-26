package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ParticipantFiles {
    List<Data> list(UUID org, UUID program, UUID enrollment);
    Data create(UUID org, UUID program, UUID enrollment, UUID actor, String title, String contentType, byte[] bytes);
    Optional<Content> content(UUID org, UUID program, UUID enrollment, UUID file);
    boolean delete(UUID org, UUID program, UUID enrollment, UUID file);
    record Data(UUID id, String title, String contentType, int sizeBytes, Instant createdAt) {}
    record Content(Data file, byte[] bytes) {}
}
