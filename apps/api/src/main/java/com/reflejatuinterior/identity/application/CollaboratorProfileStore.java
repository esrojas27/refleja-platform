package com.reflejatuinterior.identity.application;

import java.time.LocalDate;
import java.util.UUID;

public interface CollaboratorProfileStore {
    ProfileData find(UUID userId, UUID organizationId);

    ProfileData complete(UUID userId, UUID organizationId, ProfileUpdate update);

    record ProfileData(UUID organizationId, String email, String fullName,
                       LocalDate dateOfBirth, String phone, String city, String country,
                       String jobTitle, String status) {
    }

    record ProfileUpdate(String fullName, LocalDate dateOfBirth, String phone,
                         String city, String country, String jobTitle) {
    }
}
