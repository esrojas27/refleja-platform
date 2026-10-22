package com.reflejatuinterior.participation.application;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import com.reflejatuinterior.identity.NotificationAccess;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {
    private final NotificationAccess access;
    private final OrganizationTenantContext tenants;
    private final Notifications notifications;
    NotificationService(NotificationAccess access, OrganizationTenantContext tenants, Notifications notifications) {
        this.access=access; this.tenants=tenants; this.notifications=notifications;
    }
    @Transactional(readOnly=true)
    public Page list(String subject, Instant before, UUID beforeId) {
        if ((before==null)!=(beforeId==null)) throw new InvalidCursor();
        var context=access.resolve(subject);
        var rows=new ArrayList<Notifications.Item>();
        long unread=0;
        for(var org:context.organizationIds()) {
            tenants.activate(org);
            rows.addAll(notifications.list(org,context.userId(),before,beforeId,21));
            unread+=notifications.unreadCount(org,context.userId());
        }
        rows.sort(Comparator.comparing(Notifications.Item::createdAt).thenComparing(n->n.id().toString()).reversed());
        return new Page(rows.stream().limit(20).toList(),unread,rows.size()>20);
    }
    @Transactional
    public void markRead(String subject, UUID id) {
        var context=access.resolve(subject);
        for(var org:context.organizationIds()) {
            tenants.activate(org);
            if(notifications.markRead(org,context.userId(),id)) return;
        }
        throw new Missing();
    }
    public record Page(List<Notifications.Item> items,long unreadCount,boolean hasMore) {}
    public static class Missing extends RuntimeException {}
    public static class InvalidCursor extends RuntimeException {}
}
