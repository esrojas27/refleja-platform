package com.reflejatuinterior.identity.application;

import java.time.LocalDate;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CollaboratorProfileService {
    private static final Pattern PHONE = Pattern.compile("^\\+?[0-9][0-9 ()-]{6,31}$");

    private final IdentityContextService identityContext;
    private final CollaboratorProfileStore profiles;

    CollaboratorProfileService(IdentityContextService identityContext, CollaboratorProfileStore profiles) {
        this.identityContext = identityContext;
        this.profiles = profiles;
    }

    @Transactional(readOnly = true)
    public Profile get(String subject, UUID organizationId) {
        var principal = collaborator(subject, organizationId);
        return from(profiles.find(principal.userId(), organizationId), company(principal, organizationId));
    }

    @Transactional
    public Profile complete(String subject, UUID organizationId, Input input) {
        var principal = collaborator(subject, organizationId);
        var update = validate(input);
        return from(profiles.complete(principal.userId(), organizationId, update), company(principal, organizationId));
    }

    private com.reflejatuinterior.identity.domain.AuthenticatedPrincipal collaborator(
            String subject, UUID organizationId) {
        var principal = identityContext.resolve(subject, organizationId);
        if (!principal.hasRole(organizationId, "COLLABORATOR")) {
            throw new CollaboratorProfileUnavailable();
        }
        return principal;
    }

    private CollaboratorProfileStore.ProfileUpdate validate(Input input) {
        if (input == null) throw new InvalidCollaboratorProfile("profile");
        String fullName = text(input.fullName(), "fullName", 2, 200);
        if (input.dateOfBirth() == null || !input.dateOfBirth().isBefore(LocalDate.now())) {
            throw new InvalidCollaboratorProfile("dateOfBirth");
        }
        String phone = text(input.phone(), "phone", 7, 32);
        if (!PHONE.matcher(phone).matches()) throw new InvalidCollaboratorProfile("phone");
        return new CollaboratorProfileStore.ProfileUpdate(fullName, input.dateOfBirth(), phone,
                text(input.city(), "city", 2, 120), text(input.country(), "country", 2, 120),
                text(input.jobTitle(), "jobTitle", 2, 160));
    }

    private static String text(String value, String field, int minimum, int maximum) {
        if (value == null) throw new InvalidCollaboratorProfile(field);
        String clean = value.strip();
        if (clean.length() < minimum || clean.length() > maximum
                || clean.codePoints().anyMatch(Character::isISOControl)) {
            throw new InvalidCollaboratorProfile(field);
        }
        return clean;
    }

    private String company(com.reflejatuinterior.identity.domain.AuthenticatedPrincipal principal, UUID organizationId) {
        return principal.organizations().stream().filter(item -> item.id().equals(organizationId))
                .findFirst().orElseThrow(CollaboratorProfileUnavailable::new).name();
    }

    private Profile from(CollaboratorProfileStore.ProfileData data, String company) {
        return new Profile(data.organizationId(), company, data.email(), data.fullName(),
                data.dateOfBirth(), data.phone(), data.city(), data.country(), data.jobTitle(), data.status());
    }

    public record Input(String fullName, LocalDate dateOfBirth, String phone,
                        String city, String country, String jobTitle) {
    }

    public record Profile(UUID organizationId, String company, String email, String fullName,
                          LocalDate dateOfBirth, String phone, String city, String country,
                          String jobTitle, String status) {
    }
}
