package com.reflejatuinterior.participation.application;

import java.util.UUID;

/** All callers hold the program lock when changing state or content. */
public interface SessionForms {
    java.util.List<UUID> containedSessions(UUID org,UUID program,String kind,UUID id);
    String missing(UUID org,UUID program,UUID session);
    boolean hasStarted(UUID org,UUID program,UUID session);
    boolean hasClosed(UUID org,UUID program,UUID session);
    boolean isClosed(UUID org,UUID program,UUID session,UUID enrollment);
    State state(UUID org,UUID program,UUID session,UUID enrollment);
    void acknowledge(UUID org,UUID program,UUID session,UUID enrollment);
    record State(int activityCount,int submittedCount,boolean acknowledged,boolean completed) {
        public boolean readyToClose() {return activityCount>0&&activityCount==submittedCount;}
        public double percentage() {return Math.round(((activityCount==0?0:80d*submittedCount/activityCount)+(completed?20:0))*100)/100d;}
    }
}
