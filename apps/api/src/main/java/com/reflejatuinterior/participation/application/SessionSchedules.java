package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface SessionSchedules {
    List<Session> sessions(UUID org, UUID program);
    List<Person> participants(UUID org, UUID program, UUID session);
    List<OwnedSession> owned(UUID org, UUID program, UUID enrollment);
    void save(UUID org, UUID program, UUID session, Person person, LocalDate date, UUID actor, String actorLabel, String reason, String request);
    List<Revision> history(UUID org, UUID program, UUID session, UUID enrollment, int offset, int limit);
    long countHistory(UUID org, UUID program, UUID session, UUID enrollment);
    boolean hasSchedules(UUID org, UUID program, String kind, UUID id);
    List<Notifications.Item> notifications(UUID org, UUID user, Instant before, UUID beforeId, int limit);
    long unread(UUID org, UUID user);
    boolean markRead(UUID org, UUID user, UUID id);

    record Session(UUID id, UUID moduleId, String dimensionName, String name, String objective, int dimensionPosition, int position) {}
    record Person(UUID enrollmentId, String email, String name, String status, boolean enabled, LocalDate scheduledDate, Long version) {}
    record OwnedSession(Session session, LocalDate scheduledDate) {}
    record Revision(UUID id, UUID enrollmentId, LocalDate previousDate, LocalDate scheduledDate, String actorLabel, String reason, String source, Instant recordedAt) {}
}
