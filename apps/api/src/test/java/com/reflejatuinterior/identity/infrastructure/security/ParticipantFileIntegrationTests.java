package com.reflejatuinterior.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.startsWith;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@AutoConfigureMockMvc
@Import(CognitoAuthenticationIntegrationTests.JwtTestConfiguration.class)
@Transactional
class ParticipantFileIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID org=uuid7(0xa101), consultant=uuid7(0xa102), cm=uuid7(0xa103), person=uuid7(0xa104), pm=uuid7(0xa105), enrollment=uuid7(0xa106);
    private final UUID other=uuid7(0xa107), om=uuid7(0xa108), oe=uuid7(0xa109), program=uuid7(0xa10a), second=uuid7(0xa10b), foreignOrg=uuid7(0xa10c);
    @Autowired MockMvc mvc; @Autowired JwtEncoder encoder; @Autowired ObjectMapper json;
    @Autowired OrganizationTenantContext tenant; @Autowired jakarta.persistence.EntityManager em;
    @BeforeEach void setup(){
        insertOrganization(org);insertOrganization(foreignOrg);
        for(var user:List.of(consultant,person,other))insertUser(user);
        insertMembership(cm,org,consultant);insertMembership(pm,org,person);insertMembership(om,org,other);
        for(var m:List.of(cm,pm,om))jdbcTemplate.update("insert into rti.membership_roles values(?,?)",m,m.equals(cm)?"CONSULTANT":"COLLABORATOR");
        insertProgram(program,org);insertProgram(second,org);tenant.activate(org);
        jdbcTemplate.update("update rti.programs set status='ACTIVE',activated_at=now() where id=?",program);
        for(var pair:List.of(List.of(enrollment,pm),List.of(oe,om)))jdbcTemplate.update(
            "insert into rti.enrollments(id,organization_id,program_id,participant_membership_id,status,created_at,updated_at,version) values(?,?,?,?,'ACTIVE',now(),now(),0)",
            pair.get(0),org,program,pair.get(1));
    }
    private String files(){return "/api/v1/organizations/"+org+"/programs/"+program+"/enrollments/"+enrollment+"/files";}
    private String own(){return "/api/v1/me/programs/"+program+"/files";}
    private String participants(){return "/api/v1/organizations/"+org+"/programs/"+program+"/files/participants";}
    private ResultActions upload(UUID user,String title,byte[] bytes)throws Exception{
        return mvc.perform(multipart(files()).file(new MockMultipartFile("file","client-name.exe","text/html",bytes))
            .param("name",title).header("Authorization",token(user)));
    }
    private String saved()throws Exception{
        return json.readTree(upload(consultant," Mi informe ",pdf()).andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Mi informe")).andExpect(jsonPath("$.contentType").value("application/pdf"))
            .andReturn().getResponse().getContentAsString()).path("id").asText();
    }
    @Test void consultantUploadsPrivatePdfAndTheOwnerCanViewAndDownloadIt()throws Exception{
        var id=saved();
        mvc.perform(get(own()).header("Authorization",token(person))).andExpect(status().isOk())
            .andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.canManage").value(false))
            .andExpect(jsonPath("$.maxFiles").value(10)).andExpect(jsonPath("$.items[0].title").value("Mi informe"))
            .andExpect(jsonPath("$.items[0].bytes").doesNotExist()).andExpect(jsonPath("$.items[0].fileBytes").doesNotExist());
        mvc.perform(get(own()+"/"+id+"/content").param("download","true").header("Authorization",token(person)))
            .andExpect(status().isOk()).andExpect(content().contentType(MediaType.APPLICATION_PDF)).andExpect(content().bytes(pdf()))
            .andExpect(header().string("X-Content-Type-Options","nosniff"))
            .andExpect(header().string("Content-Disposition",startsWith("attachment;")));
        mvc.perform(get(files()).header("Authorization",token(consultant))).andExpect(status().isOk()).andExpect(jsonPath("$.canManage").value(true));
    }
    @Test void preventsOtherPeopleAndProgramsFromReadingOrDeletingTheFile()throws Exception{
        var id=saved();
        mvc.perform(get(own()).header("Authorization",token(other))).andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get(own()+"/"+id+"/content").header("Authorization",token(other))).andExpect(status().isNotFound());
        mvc.perform(get(files()).header("Authorization",token(person))).andExpect(status().isForbidden());
        upload(person,"Intrusión",pdf()).andExpect(status().isForbidden());
        mvc.perform(delete(files()+"/"+id).header("Authorization",token(person))).andExpect(status().isForbidden());
        mvc.perform(get(files().replace(enrollment.toString(),oe.toString())+"/"+id+"/content").header("Authorization",token(consultant))).andExpect(status().isNotFound());
        mvc.perform(delete(files().replace(enrollment.toString(),oe.toString())+"/"+id).header("Authorization",token(consultant))).andExpect(status().isNotFound());
        mvc.perform(get(files().replace(program.toString(),second.toString())).header("Authorization",token(consultant))).andExpect(status().isNotFound());
        mvc.perform(get(own().replace(program.toString(),second.toString())+"/"+id+"/content").header("Authorization",token(person))).andExpect(status().isNotFound());
        tenant.activate(foreignOrg);
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.participant_files",Long.class)).isZero();
    }
    @ParameterizedTest @ValueSource(strings={"LEADER","COMPANY_ADMIN"})
    void leadersAndHrCanReadAllParticipantFilesButCannotMutateThem(String role)throws Exception{
        var id=saved();tenant.activate(org);
        jdbcTemplate.update("insert into rti.membership_roles values(?,?)",om,role);em.clear();
        mvc.perform(get(participants()).header("Authorization",token(other))).andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.canManage").value(false));
        mvc.perform(get(files()).header("Authorization",token(other))).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(get(files()+"/"+id+"/content").header("Authorization",token(other))).andExpect(status().isOk());
        upload(other,"No autorizado",pdf()).andExpect(status().isForbidden());
        mvc.perform(delete(files()+"/"+id).header("Authorization",token(other))).andExpect(status().isForbidden());
        jdbcTemplate.update("update rti.enrollments set status='WITHDRAWN',withdrawn_at=now() where id=?",oe);em.clear();
        mvc.perform(get(files()).header("Authorization",token(other))).andExpect(status().isNotFound());
    }
    @ParameterizedTest @ValueSource(strings={"SUSPENDED","WITHDRAWN"})
    void participationRestrictionsImmediatelyBlockOwnListsAndBinaryDownloads(String state)throws Exception{
        var id=saved();tenant.activate(org);
        jdbcTemplate.update("update rti.enrollments set status=?,suspended_from_status=? where id=?",state,state.equals("SUSPENDED")?"ACTIVE":null,enrollment);em.clear();
        mvc.perform(get(own()).header("Authorization",token(person))).andExpect(status().isNotFound());
        mvc.perform(get(own()+"/"+id+"/content").header("Authorization",token(person))).andExpect(status().isNotFound());
        mvc.perform(get(files()).header("Authorization",token(consultant))).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
    }
    @Test void enforcesTenFilesAndDeletionFreesOneSlot()throws Exception{
        var first=saved();
        for(int i=1;i<10;i++)upload(consultant,"Archivo "+i,pdf()).andExpect(status().isCreated());
        upload(consultant,"Exceso",pdf()).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("FILE_LIMIT_REACHED"));
        mvc.perform(delete(files()+"/"+first).header("Authorization",token(consultant))).andExpect(status().isNoContent());
        mvc.perform(get(own()+"/"+first+"/content").header("Authorization",token(person))).andExpect(status().isNotFound());
        upload(consultant,"Nueva versión",pdf()).andExpect(status().isCreated());
        tenant.activate(org);
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.participant_files",Long.class)).isEqualTo(10);
        assertThat(jdbcTemplate.queryForObject("select count(distinct slot) from rti.participant_files",Long.class)).isEqualTo(10);
    }
    @Test void rejectsBlankNamesFakeFilesEmptyFilesAndOversizedFiles()throws Exception{
        for(var bytes:List.of(new byte[0],"Not a document".getBytes(StandardCharsets.UTF_8),"<svg onload='alert(1)'/>".getBytes(StandardCharsets.UTF_8),new byte[10*1024*1024+1]))
            upload(consultant,"Documento",bytes).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("file"));
        for(var name:List.of(" ","x".repeat(161),"Nombre\r\nInyectado"))
            upload(consultant,name,pdf()).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("name"));
        tenant.activate(org);assertThat(jdbcTemplate.queryForObject("select count(*) from rti.participant_files",Long.class)).isZero();
    }
    @Test void detectsImagesFromTheirContentsRatherThanTheClientFilenameOrMime()throws Exception{
        var image=new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB);
        var bytes=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(image,"png",bytes);
        upload(consultant,"Resultado visual",bytes.toByteArray()).andExpect(status().isCreated()).andExpect(jsonPath("$.contentType").value("image/png"));
    }
    @Test void closedProgramsKeepFilesReadableAndDraftProgramsDoNotExposeThemToCollaborators()throws Exception{
        var id=saved();tenant.activate(org);
        jdbcTemplate.update("update rti.programs set status='DRAFT',activated_at=null where id=?",program);em.clear();
        mvc.perform(get(own()).header("Authorization",token(person))).andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get(own()+"/"+id+"/content").header("Authorization",token(person))).andExpect(status().isNotFound());
        jdbcTemplate.update("update rti.programs set status='COMPLETED',activated_at=now() where id=?",program);
        jdbcTemplate.update("update rti.enrollments set status='COMPLETED',completed_at=now() where id=?",enrollment);em.clear();
        mvc.perform(get(own()+"/"+id+"/content").header("Authorization",token(person))).andExpect(status().isOk());
        upload(consultant,"Tardío",pdf()).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROGRAM_READ_ONLY"));
        mvc.perform(delete(files()+"/"+id).header("Authorization",token(consultant))).andExpect(status().isConflict());
        mvc.perform(get(files()).header("Authorization",token(consultant))).andExpect(status().isOk()).andExpect(jsonPath("$.canManage").value(false));
    }
    @Test void permitsPreparingFilesBeforeAnInvitationIsAcceptedAndRequiresAuthentication()throws Exception{
        tenant.activate(org);jdbcTemplate.update("update rti.enrollments set status='INVITED' where id=?",enrollment);em.clear();
        saved();
        mvc.perform(get(own()).header("Authorization",token(person))).andExpect(status().isNotFound());
        mvc.perform(get(participants()).header("Authorization",token(consultant))).andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get(own())).andExpect(status().isUnauthorized());
        mvc.perform(get(files())).andExpect(status().isUnauthorized());
        mvc.perform(get(participants())).andExpect(status().isUnauthorized());
    }
    @Test void allowsDeletePreflightOnlyFromTheConfiguredFrontendOrigin() throws Exception {
        mvc.perform(options(files()+"/"+uuid7(0xa1ff)).header("Origin","http://localhost:3000")
            .header("Access-Control-Request-Method","DELETE").header("Access-Control-Request-Headers","authorization"))
            .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Methods",containsString("DELETE")));
        mvc.perform(options(files()+"/"+uuid7(0xa1ff)).header("Origin","https://untrusted.example")
            .header("Access-Control-Request-Method","DELETE")).andExpect(status().isForbidden());
    }

    private byte[] pdf(){
        var out=new StringBuilder("%PDF-1.4\n");
        var objects=List.of("<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>");
        var offsets=new java.util.ArrayList<Integer>();
        for(int i=0;i<objects.size();i++){offsets.add(out.length());out.append(i+1).append(" 0 obj\n").append(objects.get(i)).append("\nendobj\n");}
        int xref=out.length();out.append("xref\n0 4\n0000000000 65535 f \n");
        offsets.forEach(o->out.append("%010d 00000 n \n".formatted(o)));
        out.append("trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n").append(xref).append("\n%%EOF\n");
        return out.toString().getBytes(StandardCharsets.US_ASCII);
    }
    private String token(UUID user){
        var now=Instant.now();var claims=JwtClaimsSet.builder().issuer(TEST_COGNITO_ISSUER).subject("cognito-"+user).issuedAt(now).expiresAt(now.plusSeconds(300))
            .claim("token_use","access").claim("client_id",TEST_COGNITO_CLIENT_ID).build();
        return "Bearer "+encoder.encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).build(),claims)).getTokenValue();
    }
}
