package com.reflejatuinterior.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.reflejatuinterior.PostgreSqlIntegrationTestSupport;
import com.reflejatuinterior.organization.OrganizationTenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@AutoConfigureMockMvc
@Import(CognitoAuthenticationIntegrationTests.JwtTestConfiguration.class)
@Transactional
class SessionClosureIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID org=uuid7(0xe01), consultant=uuid7(0xe02), cm=uuid7(0xe03), person=uuid7(0xe04), pm=uuid7(0xe05), enrollment=uuid7(0xe06);
    private final UUID other=uuid7(0xe07), om=uuid7(0xe08), oe=uuid7(0xe09), program=uuid7(0xe0a), dimension=uuid7(0xe0b), session=uuid7(0xe0c);
    @Autowired MockMvc mvc; @Autowired JwtEncoder encoder; @Autowired ObjectMapper json;
    @Autowired OrganizationTenantContext tenant;
    @Autowired jakarta.persistence.EntityManager em;
    private String base(){return "/api/v1/organizations/"+org+"/programs/"+program;}
    private String own(){return "/api/v1/me/programs/"+program;}

    @BeforeEach void setup(){
        insertOrganization(org); for(var user:List.of(consultant,person,other))insertUser(user);
        insertMembership(cm,org,consultant);insertMembership(pm,org,person);insertMembership(om,org,other);
        for(var membership:List.of(cm,pm,om))jdbcTemplate.update("insert into rti.membership_roles values(?,?)",membership,membership.equals(cm)?"CONSULTANT":"COLLABORATOR");
        insertProgram(program,org);tenant.activate(org);
        var today=LocalDate.now(ZoneId.of("America/Bogota"));
        jdbcTemplate.update("update rti.programs set status='ACTIVE',start_date=?,end_date=? where id=?",today,today.plusDays(30),program);
        jdbcTemplate.update("insert into rti.program_modules(id,organization_id,program_id,name,position,created_at,updated_at,version) values(?,?,?,'Interior',1,now(),now(),0)",dimension,org,program);
        jdbcTemplate.update("insert into rti.program_sessions(id,organization_id,program_id,module_id,name,position,created_at,updated_at,version) values(?,?,?,?,'Sesión',1,now(),now(),0)",session,org,program,dimension);
        for(var pair:List.of(List.of(enrollment,pm),List.of(oe,om)))jdbcTemplate.update("insert into rti.enrollments(id,organization_id,program_id,participant_membership_id,status,created_at,updated_at,version) values(?,?,?,?,'ACTIVE',now(),now(),0)",pair.get(0),org,program,pair.get(1));
    }
    private ResultActions postAs(String path,UUID user,Object body)throws Exception{
        return mvc.perform(post(path).header("Authorization",token(user)).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }
    private JsonNode tree(ResultActions result)throws Exception{return json.readTree(result.andReturn().getResponse().getContentAsString());}
    private JsonNode activity(int position)throws Exception{
        return tree(postAs(base()+"/activities",consultant,Map.of("sessionId",session,"title","Actividad "+position,"instructions","Responde el formulario","position",position)).andExpect(status().isCreated()));
    }
    private Map<String,Object> definition(){return Map.of("title","Formulario","questions",List.of(Map.of("prompt","Tu reflexión","type","OPEN_TEXT","position",1)));}
    private JsonNode form(JsonNode activity)throws Exception{
        return tree(postAs(base()+"/activities/"+activity.path("id").asText()+"/evaluation",consultant,definition()).andExpect(status().isCreated()));
    }
    private JsonNode closing()throws Exception{
        jdbcTemplate.update("update rti.program_sessions set objective='Reconoce lo que has logrado' where id=?",session);em.clear();
        return tree(postAs(base()+"/sessions/"+session+"/survey",consultant,definition()).andExpect(status().isOk()));
    }
    private ResultActions schedule()throws Exception{
        return postAs(base()+"/sessions/"+session+"/schedules",consultant,Map.of("scheduledDate",LocalDate.now(ZoneId.of("America/Bogota")).plusDays(5).toString(),"participants",List.of(Map.of("enrollmentId",enrollment))));
    }
    private Map<String,Object> answers(JsonNode form,long version,String text){return Map.of("version",version,"answers",List.of(Map.of("questionId",form.path("questions").get(0).path("id").asText(),"values",List.of(text))));}
    private ResultActions submit(JsonNode activity,JsonNode form,long version,String text)throws Exception{return postAs(own()+"/activities/"+activity.path("id").asText()+"/submission",person,answers(form,version,text));}
    private ResultActions state()throws Exception{return mvc.perform(get(own()+"/session-closures").header("Authorization",token(person))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));}
    private void progress(String status,int percent)throws Exception{state().andExpect(jsonPath("$.items[0].status").value(status)).andExpect(jsonPath("$.items[0].completionPercentage").value(percent));}
    private String ack(){return own()+"/sessions/"+session+"/closure-acknowledgement";}
    private String close(){return own()+"/sessions/"+session+"/closure-response";}

    @Test void schedulingRequiresEveryContentLayer()throws Exception{
        schedule().andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SESSION_MISSING_ACTIVITIES"));
        var a=activity(1);
        schedule().andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SESSION_MISSING_ACTIVITY_FORM"));
        form(a);
        schedule().andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SESSION_MISSING_CLOSING_COMMENT"));
        jdbcTemplate.update("update rti.program_sessions set objective='Mensaje de cierre' where id=?",session);em.clear();
        schedule().andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SESSION_MISSING_CLOSING_SURVEY"));
        closing();schedule().andExpect(status().isOk());
        mvc.perform(get(own()+"/activities").header("Authorization",token(person))).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(get(own()+"/session-closures").header("Authorization",token(other))).andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
    }
    @Test void deliverablesUnlockOneAcknowledgedPopupThenClosingSurveyAndFreezeAtOneHundred()throws Exception{
        var a=activity(1);var af=form(a);var b=activity(2);var bf=form(b);var cf=closing();schedule().andExpect(status().isOk());
        progress("LOCKED",0);state().andExpect(jsonPath("$.items[0].survey").isEmpty()).andExpect(jsonPath("$.items[0].closingComment").isEmpty());
        postAs(ack(),person,Map.of()).andExpect(status().isConflict());
        postAs(own()+"/activities/"+a.path("id").asText()+"/submission",person,Map.of("version",0,"answers",List.of())).andExpect(status().isBadRequest());
        progress("LOCKED",0);submit(a,af,0,"Primera entrega").andExpect(status().isOk());progress("LOCKED",40);
        submit(a,af,0,"No se puede sobrescribir").andExpect(status().isConflict());
        submit(b,bf,0,"Segunda entrega").andExpect(status().isOk());progress("COMMENT",80);
        state().andExpect(jsonPath("$.items[0].closingComment").value("Reconoce lo que has logrado")).andExpect(jsonPath("$.items[0].survey").isEmpty());
        postAs(close(),person,answers(cf,0,"Cierre prematuro")).andExpect(status().isConflict());
        postAs(ack(),person,Map.of()).andExpect(status().isOk());postAs(ack(),person,Map.of()).andExpect(status().isOk());progress("PENDING",80);
        assertThat(jdbcTemplate.queryForObject("select count(*) from rti.session_closure_acknowledgements where session_id=?",Long.class,session)).isEqualTo(1);
        postAs(close(),person,Map.of("answers",List.of())).andExpect(status().isBadRequest());progress("PENDING",80);
        postAs(close(),person,answers(cf,0,"Cierre completo")).andExpect(status().isOk());progress("COMPLETED",100);
        postAs(close(),person,answers(cf,0,"Duplicado")).andExpect(status().isConflict());
        postAs(base()+"/activities",consultant,Map.of("sessionId",session,"title","Tardía","instructions","No alterar cierre","position",3)).andExpect(status().isConflict());
        var assignment=jdbcTemplate.queryForObject("select id from rti.activity_assignments where activity_id=? and enrollment_id=?",UUID.class,UUID.fromString(a.path("id").asText()),enrollment);
        postAs(base()+"/activities/"+a.path("id").asText()+"/assignments/"+assignment+"/review",consultant,Map.of("decision","REQUEST_CHANGES","comment","No reabrir")).andExpect(status().isConflict());
        postAs(base()+"/activities/"+a.path("id").asText()+"/assignments/"+assignment+"/review",consultant,Map.of("decision","APPROVE")).andExpect(status().isOk());progress("COMPLETED",100);
    }
    @Test void requestedCorrectionPreservesPriorAnswersAndClosingAcknowledgmentAcrossReloads()throws Exception{
        var a=activity(1);var af=form(a);closing();schedule().andExpect(status().isOk());
        submit(a,af,0,"Original").andExpect(status().isOk());postAs(ack(),person,Map.of()).andExpect(status().isOk());
        var assignment=jdbcTemplate.queryForObject("select id from rti.activity_assignments where activity_id=? and enrollment_id=?",UUID.class,UUID.fromString(a.path("id").asText()),enrollment);
        postAs(base()+"/activities/"+a.path("id").asText()+"/assignments/"+assignment+"/review",consultant,Map.of("decision","REQUEST_CHANGES","comment","Amplía tu ejemplo")).andExpect(status().isOk());progress("LOCKED",0);
        submit(a,af,1,"Desactualizada").andExpect(status().isConflict());
        submit(a,af,2,"Corregida").andExpect(status().isOk());progress("PENDING",80);
        assertThat(jdbcTemplate.queryForObject("select answers::text from rti.activity_form_response_revisions where organization_id=?",String.class,org)).contains("Original").doesNotContain("Corregida");
        mvc.perform(get(own()+"/activities").header("Authorization",token(person))).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].answers[0].values[0]").value("Corregida"));
        var edited=new java.util.HashMap<String,Object>(definition());edited.put("version",0);
        postAs(base()+"/sessions/"+session+"/survey",consultant,edited).andExpect(status().isConflict());
    }
    @Test void closureEndpointsRequireOwnedScheduledActiveParticipation()throws Exception{
        var a=activity(1);form(a);var cf=closing();schedule().andExpect(status().isOk());
        postAs(ack(),other,Map.of()).andExpect(status().isNotFound());postAs(close(),other,answers(cf,0,"Ajena")).andExpect(status().isNotFound());
        postAs(base()+"/sessions/"+session+"/survey",person,definition()).andExpect(status().isForbidden());
        mvc.perform(get(own()+"/session-closures")).andExpect(status().isUnauthorized());
        jdbcTemplate.update("update rti.enrollments set status='SUSPENDED',suspended_from_status='ACTIVE' where id=?",enrollment);em.clear();
        mvc.perform(get(own()+"/session-closures").header("Authorization",token(person))).andExpect(status().isNotFound());postAs(ack(),person,Map.of()).andExpect(status().isNotFound());
    }
    private String token(UUID user){
        var now=Instant.now();var claims=JwtClaimsSet.builder().issuer(TEST_COGNITO_ISSUER).subject("cognito-"+user).issuedAt(now).expiresAt(now.plusSeconds(300)).claim("token_use","access").claim("client_id",TEST_COGNITO_CLIENT_ID).build();
        return "Bearer "+encoder.encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).build(),claims)).getTokenValue();
    }
}
