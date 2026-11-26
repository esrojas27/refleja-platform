package com.reflejatuinterior.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.ObjectMapper;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.time.Instant;
import java.util.UUID;
import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@AutoConfigureMockMvc
@Import(CognitoAuthenticationIntegrationTests.JwtTestConfiguration.class)
@Transactional
class DiscProfileIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID organization = uuid7(0xe01), program = uuid7(0xe02);
    private final UUID consultant = uuid7(0xe03), consultantMembership = uuid7(0xe04);
    private final UUID leader = uuid7(0xe05), leaderMembership = uuid7(0xe06), leaderEnrollment = uuid7(0xe07);
    private final UUID collaborator = uuid7(0xe08), collaboratorMembership = uuid7(0xe09), enrollment = uuid7(0xe0a);
    private final UUID hr = uuid7(0xe0b), hrMembership = uuid7(0xe0c);
    private final UUID leaderInvitation = uuid7(0xe0d), collaboratorInvitation = uuid7(0xe0e);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @Autowired JwtEncoder encoder;
    @Autowired OrganizationTenantContext tenantContext;

    @BeforeEach void setup() {
        insertOrganization(organization);
        insertUser(consultant); insertUser(leader); insertUser(collaborator); insertUser(hr);
        insertMembership(consultantMembership, organization, consultant);
        insertMembership(leaderMembership, organization, leader);
        insertMembership(collaboratorMembership, organization, collaborator);
        insertMembership(hrMembership, organization, hr);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'CONSULTANT')", consultantMembership);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'LEADER')", leaderMembership);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'COLLABORATOR')", collaboratorMembership);
        jdbcTemplate.update("insert into rti.membership_roles values (?, 'COMPANY_ADMIN')", hrMembership);
        insertProgram(program, organization);
        tenantContext.activate(organization);
        jdbcTemplate.update("update rti.programs set status=\'ACTIVE\',activated_at=now() where id=?",program);
        insertInvitation(leaderInvitation, leader, leaderMembership, "LEADER");
        insertInvitation(collaboratorInvitation, collaborator, collaboratorMembership, "COLLABORATOR");
        jdbcTemplate.update("""
                insert into rti.enrollments
                    (id, organization_id, program_id, participant_membership_id, invitation_id, status,
                     created_at, updated_at, version)
                values (?, ?, ?, ?, ?, 'ACTIVE', now(), now(), 0),
                       (?, ?, ?, ?, ?, 'ACTIVE', now(), now(), 0)
                """, leaderEnrollment, organization, program, leaderMembership, leaderInvitation,
                enrollment, organization, program, collaboratorMembership, collaboratorInvitation);
    }


    @Test void onlyConsultantEditsIndependentPercentagesWithAuditAndOptimisticConcurrency() throws Exception {
        mvc.perform(get(path()).header("Authorization",token(consultant))).andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].canEdit").value(true));
        save(consultant,body(null,80)).andExpect(status().isOk()).andExpect(jsonPath("$.profile.dominant").value(80))
            .andExpect(jsonPath("$.profile.version").value(0)).andExpect(jsonPath("$.profile.needsUpdate").value(false));
        save(consultant,body(0L,80)).andExpect(status().isOk()).andExpect(jsonPath("$.profile.version").value(0));
        save(consultant,body(7L,90)).andExpect(status().isConflict());
        save(leader,body(0L,90)).andExpect(status().isForbidden());
        save(consultant,body(0L,90)).andExpect(status().isOk()).andExpect(jsonPath("$.profile.version").value(1));
        mvc.perform(get(path()).header("Authorization",token(leader))).andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].canEdit").value(false)).andExpect(jsonPath("$.items[0].profile.dominant").value(90));
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.program_participant_disc_profile_revisions where enrollment_id=?",Long.class,enrollment)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject("select updated_by from rti.program_participant_disc_profiles where enrollment_id=?",UUID.class,enrollment)).isEqualTo(consultant);
    }
    @Test void acceptsZeroAndOneHundredWithoutNormalizingOrRequiringATotalOfOneHundred() throws Exception {
        save(consultant,"{\"dominant\":0,\"influential\":100,\"serene\":100,\"conscientious\":100}").andExpect(status().isOk())
            .andExpect(jsonPath("$.profile.dominant").value(0)).andExpect(jsonPath("$.profile.influential").value(100))
            .andExpect(jsonPath("$.profile.serene").value(100)).andExpect(jsonPath("$.profile.conscientious").value(100));
    }
    @Test void rejectsDecimalsOutOfRangeMissingAndTextualValues() throws Exception {
        for(var scalar:List.of("-1","101","50.5","null","\"not a number\"")){
            save(consultant,body(null,80).replace("\"dominant\":80","\"dominant\":"+scalar)).andExpect(status().isBadRequest());
        }
        mvc.perform(get(path()).header("Authorization",token(collaborator))).andExpect(status().isForbidden());
        save(collaborator,body(null,80)).andExpect(status().isForbidden());
    }
    @Test void enrolledHrCanReadButNotEditAndRestrictedReadersLoseAccess() throws Exception {
        mvc.perform(get(path()).header("Authorization",token(hr))).andExpect(status().isForbidden());
        jdbcTemplate.update("insert into rti.enrollments(id,organization_id,program_id,participant_membership_id,status,created_at,updated_at,version) values(?,?,?,?,'ACTIVE',now(),now(),0)",
            uuid7(0xe0f),organization,program,hrMembership);
        save(consultant,body(null,80)).andExpect(status().isOk());
        mvc.perform(get(path()).header("Authorization",token(hr))).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].canEdit").value(false));
        save(hr,body(0L,90)).andExpect(status().isForbidden());
        jdbcTemplate.update("update rti.enrollments set status='COMPLETED',completed_at=now() where id=?",leaderEnrollment);entityManager.clear();
        mvc.perform(get(path()).header("Authorization",token(leader))).andExpect(status().isOk());
        save(leader,body(0L,90)).andExpect(status().isForbidden());
        jdbcTemplate.update("update rti.enrollments set status='SUSPENDED',suspended_from_status='COMPLETED' where id=?",leaderEnrollment);entityManager.clear();
        mvc.perform(get(path()).header("Authorization",token(leader))).andExpect(status().isForbidden());
    }
    @Test void closedProgramsKeepReadAccessButForbidPercentagesAndPdfUploads() throws Exception {
        save(consultant,body(null,80)).andExpect(status().isOk());
        jdbcTemplate.update("update rti.programs set status='COMPLETED' where id=?",program);entityManager.clear();
        mvc.perform(get(path()).header("Authorization",token(consultant))).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].canEdit").value(false));
        save(consultant,body(0L,90)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_READ_ONLY"));
        pdf(consultant,"one").andExpect(status().isConflict());
    }
    @Test void preservesQualitativeRowsAndTheirAuditWithoutInventingPercentages() throws Exception {
        var id=uuid7(0xe10);
        jdbcTemplate.update("""
            insert into rti.program_participant_disc_profiles(id,organization_id,program_id,enrollment_id,dominant_text,influential_text,serene_text,conscientious_text,
            created_by,updated_by,created_at,updated_at,version) values(?,?,?,?,'Legacy D','Legacy I','Legacy S','Legacy C',?,?,now(),now(),3)
            """,id,organization,program,enrollment,consultant,consultant);
        jdbcTemplate.update("""
            insert into rti.program_participant_disc_profile_revisions(id,profile_id,organization_id,program_id,enrollment_id,dominant_text,influential_text,serene_text,conscientious_text,
            action,actor_id,profile_version,recorded_at) values(?,?,?,?,?,'Legacy D','Legacy I','Legacy S','Legacy C','CREATED',?,3,now())
            """,uuid7(0xe11),id,organization,program,enrollment,consultant);
        mvc.perform(get(path()).header("Authorization",token(consultant))).andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].profile.needsUpdate").value(true)).andExpect(jsonPath("$.items[0].profile.dominant").isEmpty());
        mvc.perform(get(ownDisc()).header("Authorization",token(collaborator))).andExpect(status().isOk()).andExpect(jsonPath("$.profile").isEmpty());
        save(consultant,body(3L,80)).andExpect(status().isOk()).andExpect(jsonPath("$.profile.needsUpdate").value(false)).andExpect(jsonPath("$.profile.version").value(4));
        assertThat(jdbcTemplate.queryForObject("select dominant_text from rti.program_participant_disc_profile_revisions where profile_id=? and profile_version=3",String.class,id)).isEqualTo("Legacy D");
        assertThat(jdbcTemplate.queryForObject("select dominant_percent from rti.program_participant_disc_profile_revisions where profile_id=? and profile_version=4",Integer.class,id)).isEqualTo(80);
    }
    @Test void pdfUploadsCreateNumberedPrivateFilesAndNeverOverwriteOrReuseDeletedVersions() throws Exception {
        var first=json.readTree(pdf(consultant,"one").andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("DISC")).andExpect(jsonPath("$.documentVersion").value(1))
            .andReturn().getResponse().getContentAsString()).path("id").asText();
        var second=json.readTree(pdf(consultant,"two").andExpect(status().isCreated()).andExpect(jsonPath("$.documentVersion").value(2))
            .andReturn().getResponse().getContentAsString()).path("id").asText();
        mvc.perform(get(ownFiles()).header("Authorization",token(collaborator))).andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(2)).andExpect(jsonPath("$.items[0].documentType").value("DISC"));
        mvc.perform(get(ownFiles()+"/"+first+"/content").param("download","true").header("Authorization",token(collaborator))).andExpect(status().isOk())
            .andExpect(content().bytes(pdfBytes("one"))).andExpect(header().string("Content-Disposition",org.hamcrest.Matchers.containsString("DISC-v1.pdf")));
        mvc.perform(delete(files()+"/"+second).header("Authorization",token(consultant))).andExpect(status().isNoContent());
        pdf(consultant,"three").andExpect(status().isCreated()).andExpect(jsonPath("$.documentVersion").value(3));
        mvc.perform(get(ownFiles()+"/"+first+"/content").header("Authorization",token(collaborator))).andExpect(status().isOk()).andExpect(content().bytes(pdfBytes("one")));
        mvc.perform(get(path()).header("Authorization",token(consultant))).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].profile").isEmpty());
        save(consultant,body(null,80)).andExpect(status().isOk()).andExpect(jsonPath("$.profile.version").value(0));
    }
    @Test void pdfUsesTheSharedQuotaAndCannotBeUploadedByReadersOrForIneligiblePeople() throws Exception {
        pdf(leader,"one").andExpect(status().isForbidden());pdf(hr,"one").andExpect(status().isForbidden());pdf(collaborator,"one").andExpect(status().isForbidden());
        mvc.perform(multipart(path()+"/"+leaderEnrollment+"/pdf").file(new MockMultipartFile("file","disc.pdf","application/pdf",pdfBytes("one")))
            .header("Authorization",token(consultant))).andExpect(status().isNotFound());
        mvc.perform(multipart(path()+"/"+enrollment+"/pdf").file(new MockMultipartFile("file","disc.pdf","application/pdf","fake".getBytes(StandardCharsets.UTF_8)))
            .header("Authorization",token(consultant))).andExpect(status().isBadRequest());
        for(int slot=1;slot<=10;slot++)jdbcTemplate.update("insert into rti.participant_files(id,organization_id,program_id,enrollment_id,slot,title,content_type,file_bytes,created_by) values(?,?,?,?,?,'Other document','application/pdf',?,?)",
            UUID.randomUUID(),organization,program,enrollment,slot,pdfBytes("other"),consultant);
        pdf(consultant,"one").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("FILE_LIMIT_REACHED"));
        assertThat(jdbcTemplate.queryForObject("select disc_pdf_version from rti.enrollments where id=?",Integer.class,enrollment)).isZero();
    }
    @Test void collaboratorSeesOnlyItsOwnCompleteProfileIncludingExplicitZeroValues() throws Exception {
        mvc.perform(get(ownDisc()).header("Authorization",token(collaborator))).andExpect(status().isOk())
            .andExpect(jsonPath("$.profile").isEmpty());
        save(consultant,"{\"dominant\":0,\"influential\":0,\"serene\":0,\"conscientious\":0}").andExpect(status().isOk());
        mvc.perform(get(ownDisc()).header("Authorization",token(collaborator))).andExpect(status().isOk())
            .andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.profile.dominant").value(0))
            .andExpect(jsonPath("$.profile.influential").value(0)).andExpect(jsonPath("$.profile.serene").value(0))
            .andExpect(jsonPath("$.profile.conscientious").value(0)).andExpect(jsonPath("$.profile.needsUpdate").value(false))
            .andExpect(jsonPath("$.items").doesNotExist()).andExpect(jsonPath("$.canEdit").doesNotExist());
        mvc.perform(get(ownDisc())).andExpect(status().isUnauthorized());
        mvc.perform(put(ownDisc()).header("Authorization",token(collaborator)).contentType(MediaType.APPLICATION_JSON).content(body(0L,90)))
            .andExpect(status().isForbidden());
        mvc.perform(get(path()).header("Authorization",token(collaborator))).andExpect(status().isForbidden());
    }
    @Test void anotherParticipantsIdentifiersCannotSelectTheirDiscFromThePersonalEndpoint() throws Exception {
        save(consultant,body(null,80)).andExpect(status().isOk());
        var otherUser=uuid7(0xe21);var otherMember=uuid7(0xe22);var otherEnrollment=uuid7(0xe23);
        insertUser(otherUser);insertMembership(otherMember,organization,otherUser);
        jdbcTemplate.update("insert into rti.membership_roles values(?,'COLLABORATOR')",otherMember);
        jdbcTemplate.update("insert into rti.enrollments(id,organization_id,program_id,participant_membership_id,status,created_at,updated_at,version) values(?,?,?,?,'ACTIVE',now(),now(),0)",otherEnrollment,organization,program,otherMember);
        mvc.perform(put(path()+"/"+otherEnrollment).header("Authorization",token(consultant)).contentType(MediaType.APPLICATION_JSON).content(body(null,10)))
            .andExpect(status().isOk());
        mvc.perform(get(ownDisc()).param("enrollmentId",otherEnrollment.toString()).header("Authorization",token(collaborator)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.profile.dominant").value(80));
        mvc.perform(get(ownDisc()).header("Authorization",token(otherUser))).andExpect(status().isOk()).andExpect(jsonPath("$.profile.dominant").value(10));
        mvc.perform(get(ownDisc().replace(program.toString(),uuid7(0xe24).toString())).header("Authorization",token(collaborator)))
            .andExpect(status().isNotFound());
    }
    @Test void personalDiscAccessStopsOnSuspensionOrWithdrawalAndReturnsAfterReinstatement() throws Exception {
        save(consultant,body(null,80)).andExpect(status().isOk());
        for(var state:List.of("SUSPENDED","WITHDRAWN")){
            jdbcTemplate.update("update rti.enrollments set status=?,suspended_from_status=? where id=?",state,state.equals("SUSPENDED")?"ACTIVE":null,enrollment);
            entityManager.clear();
            mvc.perform(get(ownDisc()).header("Authorization",token(collaborator))).andExpect(status().isNotFound());
        }
        jdbcTemplate.update("update rti.enrollments set status='ACTIVE',suspended_from_status=null where id=?",enrollment);entityManager.clear();
        mvc.perform(get(ownDisc()).header("Authorization",token(collaborator))).andExpect(status().isOk()).andExpect(jsonPath("$.profile.dominant").value(80));
    }
    @Test void personalDiscIsHiddenInPreparationButRemainsReadableAfterCompletion() throws Exception {
        save(consultant,body(null,80)).andExpect(status().isOk());
        jdbcTemplate.update("update rti.programs set status='DRAFT',activated_at=null where id=?",program);entityManager.clear();
        mvc.perform(get(ownDisc()).header("Authorization",token(collaborator))).andExpect(status().isOk()).andExpect(jsonPath("$.profile").isEmpty());
        jdbcTemplate.update("update rti.programs set status='COMPLETED',activated_at=now() where id=?",program);
        jdbcTemplate.update("update rti.enrollments set status='COMPLETED',completed_at=now() where id=?",enrollment);entityManager.clear();
        mvc.perform(get(ownDisc()).header("Authorization",token(collaborator))).andExpect(status().isOk()).andExpect(jsonPath("$.profile.dominant").value(80));
    }

    @ParameterizedTest @ValueSource(strings={"DRAFT","PENDING"})
    void consultantPreparesDiscBeforeAcceptanceAndTheSameProfileAndPdfBecomeReadableAfterwards(String invitationStatus) throws Exception {
        pendingInvitation(invitationStatus);
        jdbcTemplate.update("update rti.users set status='INVITED' where id=?",collaborator);
        jdbcTemplate.update("update rti.organization_memberships set status='PENDING',profile_status='PENDING',joined_at=null where id=?",collaboratorMembership);
        entityManager.clear();
        mvc.perform(get(path()).header("Authorization",token(consultant))).andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].enrollmentStatus").value("INVITED"))
            .andExpect(jsonPath("$.items[0].canEdit").value(true));
        var saved=json.readTree(save(consultant,body(null,80)).andExpect(status().isOk())
            .andExpect(jsonPath("$.enrollmentStatus").value("INVITED")).andReturn().getResponse().getContentAsString());
        var file=json.readTree(pdf(consultant,"prepared before acceptance").andExpect(status().isCreated())
            .andExpect(jsonPath("$.documentVersion").value(1)).andReturn().getResponse().getContentAsString());
        mvc.perform(get(ownDisc()).header("Authorization",token(collaborator))).andExpect(status().isForbidden());
        mvc.perform(get(ownFiles()).header("Authorization",token(collaborator))).andExpect(status().isForbidden());
        mvc.perform(get(path()).header("Authorization",token(leader))).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0));
        save(leader,body(0L,90)).andExpect(status().isForbidden());
        assertThat(jdbcTemplate.queryForObject("select status from rti.enrollments where id=?",String.class,enrollment)).isEqualTo("INVITED");
        assertThat(jdbcTemplate.queryForObject("select status from rti.users where id=?",String.class,collaborator)).isEqualTo("INVITED");
        assertThat(jdbcTemplate.queryForObject("select status from rti.user_invitations where id=?",String.class,collaboratorInvitation)).isEqualTo(invitationStatus);
        if (invitationStatus.equals("DRAFT")) {
            // Simulate the separately authorized send action; preparing DISC never sends it.
            jdbcTemplate.update("update rti.user_invitations set status='PENDING',expires_at=now()+interval '7 days',delivery_status='SENT' where id=?",collaboratorInvitation);
        }
        entityManager.clear();
        mvc.perform(post("/api/v1/invitations/"+collaboratorInvitation+"/accept").header("Authorization",token(collaborator)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.enrollmentStatus").value("ACTIVE"));
        mvc.perform(get(ownDisc()).header("Authorization",token(collaborator))).andExpect(status().isForbidden());
        jdbcTemplate.update("update rti.organization_memberships set profile_status='COMPLETE' where id=?",collaboratorMembership);entityManager.clear();
        mvc.perform(get(ownDisc()).header("Authorization",token(collaborator))).andExpect(status().isOk())
            .andExpect(jsonPath("$.profile.id").value(saved.path("profile").path("id").asText()))
            .andExpect(jsonPath("$.profile.dominant").value(80)).andExpect(jsonPath("$.profile.version").value(0));
        mvc.perform(get(ownFiles()).header("Authorization",token(collaborator))).andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].id").value(file.path("id").asText()));
        mvc.perform(get(ownFiles()+"/"+file.path("id").asText()+"/content").header("Authorization",token(collaborator)))
            .andExpect(status().isOk()).andExpect(content().bytes(pdfBytes("prepared before acceptance")));
    }

    @Test void anExistingActiveAccountCannotReadDiscFromAnEnrollmentItHasNotAccepted() throws Exception {
        pendingInvitation("PENDING");entityManager.clear();
        save(consultant,body(null,80)).andExpect(status().isOk());pdf(consultant,"pending program").andExpect(status().isCreated());
        mvc.perform(get(ownDisc()).header("Authorization",token(collaborator))).andExpect(status().isNotFound());
        mvc.perform(get(ownFiles()).header("Authorization",token(collaborator))).andExpect(status().isNotFound());
    }

    @ParameterizedTest @ValueSource(strings={"SUSPENDED","WITHDRAWN","PENDING_APPROVAL"})
    void administrativePreparationDoesNotIncludeSuspendedWithdrawnOrUnapprovedEnrollments(String state) throws Exception {
        jdbcTemplate.update("update rti.enrollments set status=?,suspended_from_status=? where id=?",state,state.equals("SUSPENDED")?"ACTIVE":null,enrollment);
        entityManager.clear();
        mvc.perform(get(path()).header("Authorization",token(consultant))).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0));
        save(consultant,body(null,80)).andExpect(status().isNotFound());pdf(consultant,"not eligible").andExpect(status().isNotFound());
    }

    @Test void pendingEligibilityUsesTheInvitedCollaboratorRoleWithoutBroadeningToLeaderInvitations() throws Exception {
        jdbcTemplate.update("update rti.enrollments set status='INVITED' where id=?",leaderEnrollment);
        jdbcTemplate.update("update rti.user_invitations set status='PENDING',accepted_at=null where id=?",leaderInvitation);entityManager.clear();
        mvc.perform(get(path()).header("Authorization",token(consultant))).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(put(path()+"/"+leaderEnrollment).header("Authorization",token(consultant)).contentType(MediaType.APPLICATION_JSON).content(body(null,80)))
            .andExpect(status().isNotFound());
        // An existing leader invited as a collaborator acquires that role only upon acceptance.
        jdbcTemplate.update("update rti.user_invitations set invited_role='COLLABORATOR' where id=?",leaderInvitation);entityManager.clear();
        mvc.perform(get(path()).header("Authorization",token(consultant))).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(2));
        mvc.perform(put(path()+"/"+leaderEnrollment).header("Authorization",token(consultant)).contentType(MediaType.APPLICATION_JSON).content(body(null,80)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.enrollmentStatus").value("INVITED"));
    }

    private void pendingInvitation(String state) {
        jdbcTemplate.update("update rti.enrollments set status='INVITED' where id=?",enrollment);
        jdbcTemplate.update("update rti.user_invitations set status=?,accepted_at=null,expires_at=?,delivery_status=? where id=?",
            state,state.equals("DRAFT")?null:java.sql.Timestamp.from(Instant.now().plusSeconds(604800)),state.equals("DRAFT")?"PENDING":"SENT",collaboratorInvitation);
    }
    private String ownDisc(){return "/api/v1/me/programs/"+program+"/disc-profile";}

    private org.springframework.test.web.servlet.ResultActions save(UUID user,String body) throws Exception {
        return mvc.perform(put(path()+"/"+enrollment).header("Authorization",token(user)).contentType(MediaType.APPLICATION_JSON).content(body));
    }
    private org.springframework.test.web.servlet.ResultActions pdf(UUID user,String value) throws Exception {
        return mvc.perform(multipart(path()+"/"+enrollment+"/pdf").file(new MockMultipartFile("file","report.pdf","application/pdf",pdfBytes(value)))
            .header("Authorization",token(user)));
    }
    private static byte[] pdfBytes(String value){return ("%PDF-1.4\n% "+value+"\n%%EOF\n").getBytes(StandardCharsets.US_ASCII);}
    private String files(){return "/api/v1/organizations/"+organization+"/programs/"+program+"/enrollments/"+enrollment+"/files";}
    private String ownFiles(){return "/api/v1/me/programs/"+program+"/files";}

    private void insertInvitation(UUID id, UUID userId, UUID membershipId, String role) {
        jdbcTemplate.update("""
                insert into rti.user_invitations
                    (id, organization_id, user_id, membership_id, invited_by, cognito_username,
                     invited_role, status, expires_at, accepted_at, delivery_status,
                     created_at, updated_at, version)
                values (?, ?, ?, ?, ?, ?, ?, 'ACCEPTED', now() + interval '7 days', now(), 'SENT', now(), now(), 0)
                """, id, organization, userId, membershipId, consultant, "cognito-" + userId, role);
    }

    private String path() {
        return "/api/v1/organizations/" + organization + "/programs/" + program + "/disc-profiles";
    }

    private String body(Long version,Integer dominant) {
        return "{\"dominant\":"+dominant+",\"influential\":65,\"serene\":30,\"conscientious\":45,\"version\":"+version+"}";
    }

    private String token(UUID userId) {
        var now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(TEST_COGNITO_ISSUER).subject("cognito-" + userId)
                .issuedAt(now).expiresAt(now.plusSeconds(300)).claim("token_use", "access")
                .claim("client_id", TEST_COGNITO_CLIENT_ID).build();
        return "Bearer " + encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(SignatureAlgorithm.RS256).build(), claims)).getTokenValue();
    }
}
