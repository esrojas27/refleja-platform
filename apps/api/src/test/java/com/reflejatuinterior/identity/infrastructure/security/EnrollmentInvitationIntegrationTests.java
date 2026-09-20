package com.reflejatuinterior.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;
import com.reflejatuinterior.identity.CollaboratorInvitations.Account;
import com.reflejatuinterior.identity.CollaboratorInvitations.DeliveryUnavailable;
import com.reflejatuinterior.identity.CollaboratorInvitations.Person;
import com.reflejatuinterior.identity.application.InvitationGateway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Real JWT verification, module services, PostgreSQL constraints and committed delivery state.
 * Only the external Cognito/SES boundary is mocked; no live account or email is created. */
@AutoConfigureMockMvc
@Import(CognitoAuthenticationIntegrationTests.JwtTestConfiguration.class)
class EnrollmentInvitationIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID organization = uuid7(0xa01), other = uuid7(0xa02), actor = uuid7(0xa03);
    private final UUID actorMembership = uuid7(0xa04), program = uuid7(0xa05), foreignProgram = uuid7(0xa06);
    private final UUID existingUser = uuid7(0xa07), existingMembership = uuid7(0xa08);
    private static final String EMAIL = "participant-010@example.test";
    private static final String SUBJECT = "rti-010-test-participant-010@example.test";

    @Autowired MockMvc mvc;
    @Autowired JwtEncoder encoder;
    @Autowired ObjectMapper json;
    @MockitoBean InvitationGateway gateway;
    private String consultant;

    @BeforeEach void setup() {
        cleanup();
        insertOrganization(organization);
        insertOrganization(other);
        insertUser(actor);
        insertMembership(actorMembership, organization, actor);
        actorRole("CONSULTANT");
        insertProgram(program, organization);
        insertProgram(foreignProgram, other);
        consultant = token("cognito-" + actor);
        when(gateway.provision(any(Person.class))).thenAnswer(invocation -> {
            Person person = invocation.getArgument(0);
            return new Account("rti-010-test-" + person.email(), person.email(), true);
        });
        when(gateway.sendInvitation(any())).thenReturn("test-ses-message-id");
    }

    @AfterEach void cleanup() {
        // This connection belongs exclusively to the disposable Testcontainers database.
        // Restrict deletion to this suite's two organizations and canonical test subjects.
        migratorJdbcTemplate().update("delete from rti.enrollments where organization_id in (?, ?)", organization, other);
        migratorJdbcTemplate().update("delete from rti.user_invitations where organization_id in (?, ?)", organization, other);
        migratorJdbcTemplate().update("delete from rti.programs where organization_id in (?, ?)", organization, other);
        jdbcTemplate.update("delete from rti.membership_roles where membership_id in "
                + "(select id from rti.organization_memberships where organization_id in (?, ?))", organization, other);
        jdbcTemplate.update("delete from rti.organization_memberships where organization_id in (?, ?)", organization, other);
        jdbcTemplate.update("delete from rti.users where id in (?, ?) or cognito_subject like 'rti-010-test-%'", actor, existingUser);
        jdbcTemplate.update("delete from rti.organizations where id in (?, ?)", organization, other);
    }

    @Test void createsAnInvitedEnrollmentAndSevenDayInvitationWithoutActivatingAccess() throws Exception {
        Instant before = Instant.now();
        var response = create(organization, program, valid(EMAIL)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.organizationId").value(organization.toString()))
                .andExpect(jsonPath("$.programId").value(program.toString()))
                .andExpect(jsonPath("$.status").value("INVITED"))
                .andExpect(jsonPath("$.participant.email").value(EMAIL))
                .andExpect(jsonPath("$.participant.firstName").value("Ana"))
                .andExpect(jsonPath("$.invitation.role").value("COLLABORATOR"))
                .andExpect(jsonPath("$.invitation.status").value("PENDING"))
                .andExpect(jsonPath("$.invitation.deliveryStatus").value("SENT"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().exists("X-Request-ID")).andReturn().getResponse();
        var enrollment = json.readTree(response.getContentAsString());
        assertThat(id(enrollment).version()).isEqualTo(7);
        assertThat(invitation(enrollment).version()).isEqualTo(7);
        assertThat(Instant.parse(enrollment.path("invitation").path("expiresAt").asText()))
                .isBetween(before.plus(Duration.ofDays(7)), Instant.now().plus(Duration.ofDays(7)));
        assertPending(enrollment);
        assertThat(roles(membership(enrollment))).containsExactly("COLLABORATOR");
        assertThat(jdbcTemplate.queryForObject("select cognito_subject from rti.users where id=?", String.class, user(enrollment)))
                .isEqualTo(SUBJECT);
        assertThat(migratorJdbcTemplate().queryForObject("select version from rti.enrollments where id=?", Long.class, id(enrollment))).isZero();
        mvc.perform(get("/api/v1/me").header("Authorization", token(SUBJECT))).andExpect(status().isForbidden());
        verify(gateway).sendWelcomeIfRequired(any());
        verify(gateway).sendInvitation(any());
    }

    @ParameterizedTest @ValueSource(strings = {"LEADER", "COMPANY_ADMIN"})
    void grantsTheSelectedOrganizationRoleOnlyWhenTheInvitationIsAccepted(String role) throws Exception {
        var enrollment = json.readTree(create(organization, program, valid(EMAIL, role)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.invitation.role").value(role))
                .andReturn().getResponse().getContentAsString());
        assertThat(jdbcTemplate.queryForObject("select invited_role from rti.user_invitations where id=?", String.class,
                invitation(enrollment))).isEqualTo(role);
        assertThat(roles(membership(enrollment))).containsExactly(role);
        assertPending(enrollment);

        accept(enrollment, SUBJECT).andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value(role));
        assertThat(roles(membership(enrollment))).containsExactly(role);
        mvc.perform(get("/api/v1/me").header("Authorization", token(SUBJECT)).param("organizationId", organization.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.roles[0]").value(role));
        // Existing ADR-003 policy applies: both roles can read program metadata,
        // but this increment does not grant participant-management access.
        mvc.perform(get("/api/v1/organizations/" + organization + "/programs/" + program)
                        .header("Authorization", token(SUBJECT)))
                .andExpect(status().isOk());
        mvc.perform(get(path(organization, program)).header("Authorization", token(SUBJECT)))
                .andExpect(status().isForbidden());
    }

    @ParameterizedTest @ValueSource(strings = {"CONSULTANT", "SUPER_ADMIN", "HR"})
    void rejectsRolesOutsideTheInviteableAllowlist(String role) throws Exception {
        create(organization, program, valid(EMAIL, role)).andExpect(status().isBadRequest());
        assertThat(count("enrollments")).isZero();
        verifyNoInteractions(gateway);
    }

    @Test void listsOnlyTheRequestedProgramsParticipantsWithPagination() throws Exception {
        var first = enroll(EMAIL);
        var second = enroll("second-010@example.test");
        var thirdProgram = uuid7(0xa09);
        insertProgram(thirdProgram, organization);
        create(organization, thirdProgram, valid("third-010@example.test")).andExpect(status().isCreated());
        mvc.perform(get(path(organization, program)).header("Authorization", consultant).param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(id(second).toString()))
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(get(path(organization, program)).header("Authorization", consultant).param("size", "1").param("page", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(id(first).toString()));
    }

    @Test void duplicateEnrollmentReturns409WithoutAnotherInvitationOrEmail() throws Exception {
        enroll(EMAIL);
        clearInvocations(gateway);
        create(organization, program, valid(EMAIL)).andExpect(status().isConflict());
        assertThat(count("enrollments")).isEqualTo(1);
        assertThat(count("user_invitations")).isEqualTo(1);
        verify(gateway, never()).sendInvitation(any());
        verify(gateway, never()).sendWelcomeIfRequired(any());
    }

    @Test void everyEnrollmentAndInvitationOperationRequiresAnAccessToken() throws Exception {
        mvc.perform(get(path(organization, program))).andExpect(status().isUnauthorized());
        mvc.perform(post(path(organization, program)).contentType(MediaType.APPLICATION_JSON).content(valid(EMAIL)))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/invitations")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/invitations/" + uuid7(0xa10) + "/accept")).andExpect(status().isUnauthorized());
        mvc.perform(post(path(organization, program) + "/" + uuid7(0xa10) + "/invitation-delivery"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(gateway);
    }

    @ParameterizedTest @ValueSource(strings = {"COMPANY_ADMIN", "LEADER", "COLLABORATOR", "SUPER_ADMIN"})
    void onlyAnActualTenantConsultantCanCreateAndListParticipants(String role) throws Exception {
        actorRole(role);
        create(organization, program, valid(EMAIL)).andExpect(status().isForbidden());
        mvc.perform(get(path(organization, program)).header("Authorization", consultant)).andExpect(status().isForbidden());
        verifyNoInteractions(gateway);
    }

    @Test void wrongTenantUnknownProgramAndUnknownOrganizationReturn404BeforeCognito() throws Exception {
        create(organization, foreignProgram, valid(EMAIL)).andExpect(status().isNotFound());
        create(other, foreignProgram, valid(EMAIL)).andExpect(status().isNotFound());
        create(organization, uuid7(0xa99), valid(EMAIL)).andExpect(status().isNotFound());
        create(uuid7(0xa98), foreignProgram, valid(EMAIL)).andExpect(status().isNotFound());
        mvc.perform(get(path(organization, foreignProgram)).header("Authorization", consultant)).andExpect(status().isNotFound());
        assertThat(count("enrollments")).isZero();
        verifyNoInteractions(gateway);
    }

    @Test void consultantPermissionsAreNotCombinedAcrossOrganizationsOrTakenFromTokenClaims() throws Exception {
        var anotherMembership = uuid7(0xa11);
        insertMembership(anotherMembership, other, actor);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'COLLABORATOR')", anotherMembership);
        create(other, foreignProgram, valid(EMAIL)).andExpect(status().isForbidden());
        verifyNoInteractions(gateway);
    }

    @ParameterizedTest @ValueSource(strings = {"SUSPENDED", "REVOKED", "PENDING"})
    void consultantMembershipRevocationIsEffectiveWithTheSameToken(String state) throws Exception {
        jdbcTemplate.update("update rti.organization_memberships set status=? where id=?", state, actorMembership);
        create(organization, program, valid(EMAIL)).andExpect(status().isNotFound());
        verifyNoInteractions(gateway);
    }

    @ParameterizedTest @ValueSource(strings = {"SUSPENDED", "DEACTIVATED"})
    void anInactiveTenantCannotBeUsed(String state) throws Exception {
        jdbcTemplate.update("update rti.organizations set status=? where id=?", state, organization);
        create(organization, program, valid(EMAIL)).andExpect(status().isNotFound());
        verifyNoInteractions(gateway);
    }

    @ParameterizedTest @ValueSource(strings = {"{}", "{", "{\"email\":\"invalid\",\"firstName\":\"Ana\",\"lastName\":\"Gómez\"}",
            "{\"email\":\"valid@example.test\",\"firstName\":\" \",\"lastName\":\"Gómez\"}"})
    void validationErrorsDoNotProvisionOrPersist(String input) throws Exception {
        create(organization, program, input).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        assertThat(count("enrollments")).isZero();
        verifyNoInteractions(gateway);
    }

    @ParameterizedTest @ValueSource(strings = {"page=-1", "size=101", "size=0", "page=2147483647&size=100"})
    void enrollmentAndOwnedInvitationListsRejectInvalidPagination(String query) throws Exception {
        mvc.perform(get(path(organization, program) + "?" + query).header("Authorization", consultant))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/invitations?" + query).header("Authorization", consultant))
                .andExpect(status().isBadRequest());
    }

    @Test void authenticatedAcceptanceAtomicallyActivatesOnlyTheInvitedAccess() throws Exception {
        var enrollment = enroll(EMAIL);
        accept(enrollment, SUBJECT).andExpect(status().isOk())
                .andExpect(jsonPath("$.invitationId").value(invitation(enrollment).toString()))
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.enrollmentId").value(id(enrollment).toString()))
                .andExpect(jsonPath("$.enrollmentStatus").value("ACTIVE"));
        assertState("users", user(enrollment), "ACTIVE");
        assertState("organization_memberships", membership(enrollment), "ACTIVE");
        assertState("enrollments", id(enrollment), "ACTIVE");
        assertState("user_invitations", invitation(enrollment), "ACCEPTED");
        mvc.perform(get("/api/v1/me").header("Authorization", token(SUBJECT)).param("organizationId", organization.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.roles[0]").value("COLLABORATOR"));
        // Acceptance does not grant the consultant's participant-management permission.
        mvc.perform(get(path(organization, program)).header("Authorization", token(SUBJECT))).andExpect(status().isForbidden());
    }

    @Test void invitationOwnershipUsesCanonicalSubjectNotAnEmailOrClaimSuppliedByTheCaller() throws Exception {
        var enrollment = enroll(EMAIL);
        accept(enrollment, "cognito-" + actor).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/invitations").header("Authorization", token("cognito-" + actor)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        assertPending(enrollment);
    }

    @Test void merelyListingOwnedInvitationsDoesNotActivateTheUserOrMembership() throws Exception {
        var enrollment = enroll(EMAIL);
        enroll("other-010@example.test");
        mvc.perform(get("/api/v1/invitations").header("Authorization", token(SUBJECT)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(invitation(enrollment).toString()))
                .andExpect(jsonPath("$.items[0].organizationId").value(organization.toString()))
                .andExpect(jsonPath("$.items[0].programId").value(program.toString()))
                .andExpect(header().string("Cache-Control", "no-store"));
        assertPending(enrollment);
    }

    @Test void expiredInvitationReturns410WithoutActivatingAnyRecord() throws Exception {
        var enrollment = enroll(EMAIL);
        expire(enrollment);
        accept(enrollment, SUBJECT).andExpect(status().isGone());
        assertPending(enrollment);
    }

    @Test void repeatedAcceptanceIsIdempotentButCannotRestoreARevokedMembership() throws Exception {
        var enrollment = enroll(EMAIL);
        accept(enrollment, SUBJECT).andExpect(status().isOk());
        long version = migratorJdbcTemplate().queryForObject("select version from rti.enrollments where id=?", Long.class, id(enrollment));
        accept(enrollment, SUBJECT).andExpect(status().isOk());
        assertThat(migratorJdbcTemplate().queryForObject("select version from rti.enrollments where id=?", Long.class, id(enrollment))).isEqualTo(version);
        jdbcTemplate.update("update rti.organization_memberships set status='REVOKED' where id=?", membership(enrollment));
        accept(enrollment, SUBJECT).andExpect(status().isConflict());
        assertState("organization_memberships", membership(enrollment), "REVOKED");
    }

    @Test void anExistingActiveUsersProfileAndRolesArePreservedUntilExplicitAcceptance() throws Exception {
        existingParticipant("ACTIVE", "ACTIVE");
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'COMPANY_ADMIN')", existingMembership);
        when(gateway.provision(any(Person.class))).thenReturn(new Account(SUBJECT, EMAIL, false));
        var enrollment = enroll(EMAIL);
        assertThat(user(enrollment)).isEqualTo(existingUser);
        assertThat(membership(enrollment)).isEqualTo(existingMembership);
        assertState("users", existingUser, "ACTIVE");
        assertState("organization_memberships", existingMembership, "ACTIVE");
        assertState("enrollments", id(enrollment), "INVITED");
        assertThat(roles(existingMembership)).containsExactly("COMPANY_ADMIN");
        assertThat(jdbcTemplate.queryForObject("select first_name from rti.users where id=?", String.class, existingUser)).isEqualTo("Existing");
        assertThat(jdbcTemplate.queryForObject("select last_name from rti.users where id=?", String.class, existingUser)).isEqualTo("Profile");
        accept(enrollment, SUBJECT).andExpect(status().isOk());
        assertThat(roles(existingMembership)).containsExactly("COLLABORATOR", "COMPANY_ADMIN");
    }

    @ParameterizedTest @ValueSource(strings = {"SUSPENDED", "DEACTIVATED"})
    void cannotInviteOrReactivateASuspendedOrDeactivatedUser(String state) throws Exception {
        existingParticipant(state, "ACTIVE");
        create(organization, program, valid(EMAIL)).andExpect(status().isForbidden());
        assertState("users", existingUser, state);
        assertThat(count("enrollments")).isZero();
        verify(gateway, never()).sendInvitation(any());
    }

    @ParameterizedTest @ValueSource(strings = {"SUSPENDED", "REVOKED"})
    void cannotInviteOrReactivateASuspendedOrRevokedMembership(String state) throws Exception {
        existingParticipant("ACTIVE", state);
        create(organization, program, valid(EMAIL)).andExpect(status().isConflict());
        assertState("organization_memberships", existingMembership, state);
        assertThat(count("enrollments")).isZero();
        verify(gateway, never()).sendInvitation(any());
    }

    @Test void reuseIsByCognitoSubjectAndDoesNotRelinkAnExistingUserWithTheSameEmail() throws Exception {
        existingParticipant("ACTIVE", "ACTIVE");
        jdbcTemplate.update("update rti.users set cognito_subject='rti-010-test-different-canonical-subject' where id=?", existingUser);
        create(organization, program, valid(EMAIL)).andExpect(status().isConflict());
        assertThat(count("enrollments")).isZero();
        assertThat(jdbcTemplate.queryForObject("select cognito_subject from rti.users where id=?", String.class, existingUser))
                .isEqualTo("rti-010-test-different-canonical-subject");
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.users where cognito_subject=?", Long.class, SUBJECT)).isZero();
    }

    @Test void deliveryFailurePreservesCommittedEnrollmentAndRetryDoesNotDuplicateOrExtendValidity() throws Exception {
        when(gateway.sendInvitation(any())).thenThrow(new DeliveryUnavailable());
        var enrollment = create(organization, program, valid(EMAIL)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.invitation.deliveryStatus").value("FAILED")).andReturn().getResponse();
        var saved = json.readTree(enrollment.getContentAsString());
        String expiration = saved.path("invitation").path("expiresAt").asText();
        assertPending(saved);
        doReturn("retried-ses-message-id").when(gateway).sendInvitation(any());
        retry(saved, organization, program).andExpect(status().isOk())
                .andExpect(jsonPath("$.invitation.deliveryStatus").value("SENT"))
                .andExpect(jsonPath("$.invitation.expiresAt").value(expiration));
        assertThat(count("enrollments")).isEqualTo(1);
        assertThat(count("user_invitations")).isEqualTo(1);
        verify(gateway, times(1)).sendWelcomeIfRequired(any());
        verify(gateway, times(2)).sendInvitation(any());
    }

    @Test void credentialsDeliveryFailureRemainsRecoverableWithoutPretendingAnInvitationWasSent() throws Exception {
        doThrow(new DeliveryUnavailable()).when(gateway).sendWelcomeIfRequired(any());
        var enrollment = create(organization, program, valid(EMAIL)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.invitation.deliveryStatus").value("FAILED")).andReturn().getResponse();
        assertPending(json.readTree(enrollment.getContentAsString()));
        verify(gateway, never()).sendInvitation(any());
    }

    @Test void deliveryRetryIsTenantScopedAndDoesNotSendAnAlreadyDeliveredInvitationAgain() throws Exception {
        var enrollment = enroll(EMAIL);
        clearInvocations(gateway);
        retry(enrollment, other, foreignProgram).andExpect(status().isNotFound());
        retry(enrollment, organization, foreignProgram).andExpect(status().isNotFound());
        retry(enrollment, organization, program).andExpect(status().isOk());
        verifyNoInteractions(gateway);
    }

    @Test void suspendingAccessBetweenInvitationAndAcceptanceCannotBeBypassed() throws Exception {
        var enrollment = enroll(EMAIL);
        jdbcTemplate.update("update rti.users set status='SUSPENDED' where id=?", user(enrollment));
        accept(enrollment, SUBJECT).andExpect(status().isForbidden());
        assertState("users", user(enrollment), "SUSPENDED");
        assertState("organization_memberships", membership(enrollment), "PENDING");
        assertState("enrollments", id(enrollment), "INVITED");
        assertState("user_invitations", invitation(enrollment), "PENDING");
    }

    @Test void acceptingOneProgramsInvitationDoesNotActivateAnotherEnrollment() throws Exception {
        var first = enroll(EMAIL);
        var secondProgram = uuid7(0xa12);
        insertProgram(secondProgram, organization);
        var second = json.readTree(create(organization, secondProgram, valid(EMAIL)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        accept(first, SUBJECT).andExpect(status().isOk());
        assertState("enrollments", id(first), "ACTIVE");
        assertState("enrollments", id(second), "INVITED");
        assertState("user_invitations", invitation(second), "PENDING");
    }

    private JsonNode enroll(String email) throws Exception {
        return json.readTree(create(organization, program, valid(email)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
    }
    private void existingParticipant(String userState, String memberState) {
        insertUser(existingUser);
        jdbcTemplate.update("update rti.users set cognito_subject=?, email=?, email_normalized=?, first_name='Existing', last_name='Profile', status=? where id=?",
                SUBJECT, EMAIL, EMAIL, userState, existingUser);
        insertMembership(existingMembership, organization, existingUser);
        jdbcTemplate.update("update rti.organization_memberships set status=? where id=?", memberState, existingMembership);
    }
    private void actorRole(String role) {
        jdbcTemplate.update("delete from rti.membership_roles where membership_id=?", actorMembership);
        jdbcTemplate.update("insert into rti.membership_roles values (?, ?)", actorMembership, role);
    }
    private void assertPending(JsonNode enrollment) {
        assertState("users", user(enrollment), "INVITED");
        assertState("organization_memberships", membership(enrollment), "PENDING");
        assertState("enrollments", id(enrollment), "INVITED");
        assertState("user_invitations", invitation(enrollment), "PENDING");
    }
    private void assertState(String table, UUID id, String state) {
        var database = "enrollments".equals(table) ? migratorJdbcTemplate() : jdbcTemplate;
        assertThat(database.queryForObject("select status from rti." + table + " where id=?", String.class, id)).isEqualTo(state);
    }
    private long count(String table) {
        var database = "enrollments".equals(table) ? migratorJdbcTemplate() : jdbcTemplate;
        return database.queryForObject("select count(*) from rti." + table + " where organization_id in (?, ?)", Long.class, organization, other);
    }
    private List<String> roles(UUID membership) {
        return jdbcTemplate.queryForList("select role from rti.membership_roles where membership_id=? order by role", String.class, membership);
    }
    private void expire(JsonNode enrollment) {
        jdbcTemplate.update("update rti.user_invitations set created_at=now()-interval '8 days', expires_at=now()-interval '1 second' where id=?",
                invitation(enrollment));
    }
    private UUID id(JsonNode enrollment) { return UUID.fromString(enrollment.path("id").asText()); }
    private UUID user(JsonNode enrollment) { return UUID.fromString(enrollment.path("participant").path("userId").asText()); }
    private UUID membership(JsonNode enrollment) { return UUID.fromString(enrollment.path("participant").path("membershipId").asText()); }
    private UUID invitation(JsonNode enrollment) { return UUID.fromString(enrollment.path("invitation").path("id").asText()); }
    private String path(UUID org, UUID programId) { return "/api/v1/organizations/" + org + "/programs/" + programId + "/enrollments"; }
    private ResultActions create(UUID org, UUID programId, String body) throws Exception {
        return mvc.perform(post(path(org, programId)).header("Authorization", consultant).contentType(MediaType.APPLICATION_JSON).content(body));
    }
    private ResultActions accept(JsonNode enrollment, String subject) throws Exception {
        return mvc.perform(post("/api/v1/invitations/" + invitation(enrollment) + "/accept").header("Authorization", token(subject)));
    }
    private ResultActions retry(JsonNode enrollment, UUID org, UUID programId) throws Exception {
        return mvc.perform(post(path(org, programId) + "/" + id(enrollment) + "/invitation-delivery").header("Authorization", consultant));
    }
    private String valid(String email) { return json.writeValueAsString(Map.of("email", email, "firstName", "Ana", "lastName", "Gómez")); }
    private String valid(String email, String role) {
        return json.writeValueAsString(Map.of("email", email, "firstName", "Ana", "lastName", "Gómez", "role", role));
    }
    private String token(String subject) {
        var now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(TEST_COGNITO_ISSUER).subject(subject).issuedAt(now).expiresAt(now.plusSeconds(300))
                .claim("token_use", "access").claim("client_id", TEST_COGNITO_CLIENT_ID)
                .claim("email", EMAIL).claim("cognito:groups", List.of("CONSULTANT", "SUPER_ADMIN"))
                .claim("custom:organizationId", other.toString()).build();
        return "Bearer " + encoder.encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).build(), claims)).getTokenValue();
    }
}
