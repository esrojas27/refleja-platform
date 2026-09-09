package com.reflejatuinterior.organization.domain;

import java.time.ZoneId;
import com.reflejatuinterior.organization.InvalidOrganizationInput;

public record NewOrganization(String name, String defaultTimeZone) {
    public NewOrganization {
        if (name == null || name.isBlank() || name.length() > 255 ||
                name.codePoints().anyMatch(Character::isISOControl)) {
            throw new InvalidOrganizationInput("name");
        }
        name = name.strip();
        if (defaultTimeZone == null || defaultTimeZone.length() > 255 ||
                !ZoneId.getAvailableZoneIds().contains(defaultTimeZone)) {
            throw new InvalidOrganizationInput("defaultTimeZone");
        }
    }

    public String initialStatus() { return "ACTIVE"; }
}
