package com.reflejatuinterior.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@AutoConfigureMockMvc
@Import(CognitoAuthenticationIntegrationTests.JwtTestConfiguration.class)
@Transactional
class QuestionnaireTemplateIntegrationTests extends PostgreSqlIntegrationTestSupport {
    private final UUID org=uuid7(0xf01), destination=uuid7(0xf02), consultant=uuid7(0xf03), cm=uuid7(0xf04), dm=uuid7(0xf05);
    private final UUID person=uuid7(0xf06), pm=uuid7(0xf07), enrollment=uuid7(0xf08);
    private final UUID program=uuid7(0xf09), otherProgram=uuid7(0xf0a), dimension=uuid7(0xf0b), otherDimension=uuid7(0xf0c), session=uuid7(0xf0d), otherSession=uuid7(0xf0e);
    @Autowired MockMvc mvc;@Autowired JwtEncoder encoder;@Autowired ObjectMapper json;@Autowired OrganizationTenantContext tenant;
    @Autowired jakarta.persistence.EntityManager em;

    @BeforeEach void setup(){
        insertOrganization(org);insertOrganization(destination);insertUser(consultant);insertUser(person);
        insertMembership(cm,org,consultant);insertMembership(dm,destination,consultant);insertMembership(pm,org,person);
        for(var m:List.of(cm,dm,pm))jdbcTemplate.update("insert into rti.membership_roles values(?,?)",m,m.equals(pm)?"COLLABORATOR":"CONSULTANT");
        insertProgram(program,org);insertProgram(otherProgram,destination);
        for(var p:List.of(List.of(org,program,dimension,session),List.of(destination,otherProgram,otherDimension,otherSession))){
            tenant.activate(p.get(0));
            jdbcTemplate.update("insert into rti.program_modules(id,organization_id,program_id,name,position,created_at,updated_at,version) values(?,?,?,'Interior',1,now(),now(),0)",p.get(2),p.get(0),p.get(1));
            jdbcTemplate.update("insert into rti.program_sessions(id,organization_id,program_id,module_id,name,objective,position,created_at,updated_at,version) values(?,?,?,?,'Sesión','Comentario de cierre',1,now(),now(),0)",p.get(3),p.get(0),p.get(1),p.get(2));
        }
        tenant.activate(org);
    }
    private String base(UUID company){return "/api/v1/organizations/"+company+"/questionnaire-templates";}
    private String programBase(UUID company,UUID programId){return "/api/v1/organizations/"+company+"/programs/"+programId;}
    private ResultActions postAs(String path,UUID user,Object body)throws Exception{
        return mvc.perform(post(path).header("Authorization",token(user)).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }
    private JsonNode tree(ResultActions result)throws Exception{return json.readTree(result.andReturn().getResponse().getContentAsString());}
    private JsonNode activity(UUID company,UUID programId,UUID sessionId,int position)throws Exception{
        return tree(postAs(programBase(company,programId)+"/activities",consultant,Map.of("sessionId",sessionId,"title","Actividad "+position,"instructions","Responde","position",position)).andExpect(status().isCreated()));
    }
    private Map<String,Object> definition(){return Map.of("title","Reflexiones reutilizables","instructions","Desde tu experiencia", "questions",List.of(
        Map.of("prompt","Acuerdo","type","AGREEMENT_SCALE","position",1),
        Map.of("prompt","Probabilidad","type","LIKELIHOOD_SCALE","position",2),
        Map.of("prompt","Aprendizaje","type","OPEN_TEXT","position",3),
        Map.of("prompt","Emociones","type","EMOTION_MULTI_SELECT","position",4),
        Map.of("prompt","Nivel","type","NUMERIC_SCALE","position",5),
        Map.of("prompt","Elige una alternativa","type","SINGLE_CHOICE_LETTERS","position",6,"options",List.of("Alternativa uno","Alternativa dos")),
        Map.of("prompt","Fortaleza","type","SINGLE_CHOICE_WORDS","position",7,"options",List.of("Claridad","Autenticidad","Empatía"))));}
    private JsonNode activityForm(JsonNode activity)throws Exception{
        return tree(postAs(programBase(org,program)+"/activities/"+activity.path("id").asText()+"/evaluation",consultant,definition()).andExpect(status().isCreated()));
    }
    private JsonNode saveTemplate(JsonNode form,String name)throws Exception{
        return tree(postAs(base(org),consultant,Map.of("sourceProgramId",program,"sourceEvaluationId",form.path("id").asText(),"name",name,"description","Para reutilizar"))
            .andExpect(status().isCreated()).andExpect(header().string("Cache-Control","no-store")).andExpect(header().exists("X-Request-ID")));
    }

    @Test void activityTemplateCanCreateSessionSurveyInAnotherOrganizationWithoutCopyingResponsesOrIdentifiers()throws Exception{
        tenant.activate(org);jdbcTemplate.update("update rti.programs set status='ACTIVE' where id=?",program);
        jdbcTemplate.update("insert into rti.enrollments(id,organization_id,program_id,participant_membership_id,status,created_at,updated_at,version) values(?,?,?,?,'ACTIVE',now(),now(),0)",enrollment,org,program,pm);
        jdbcTemplate.update("insert into rti.session_schedules(organization_id,program_id,session_id,enrollment_id,scheduled_date) values(?,?,?,?,'2026-10-25')",org,program,session,enrollment);em.clear();
        var a=activity(org,program,session,1);var form=activityForm(a);
        var values=List.of(List.of("4"),List.of("3"),List.of("Mi respuesta privada"),List.of("Inspirado(a)"),List.of("5"),List.of("Alternativa dos"),List.of("Autenticidad"));
        var answers=java.util.stream.IntStream.range(0,7).mapToObj(i->Map.of("questionId",form.path("questions").get(i).path("id").asText(),"values",values.get(i))).toList();
        postAs("/api/v1/me/programs/"+program+"/activities/"+a.path("id").asText()+"/submission",person,Map.of("answers",answers,"version",0)).andExpect(status().isOk());
        var template=saveTemplate(form,"Plantilla transversal");var id=template.path("summary").path("id").asText();
        assertThat(template.toString()).doesNotContain("Mi respuesta privada",person.toString(),enrollment.toString(),"completedAt","answers",form.path("id").asText());
        var replacement=new java.util.HashMap<String,Object>(definition());replacement.put("version",0);
        mvc.perform(put(programBase(org,program)+"/content/activities/"+a.path("id").asText()+"/survey").header("Authorization",token(consultant))
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(replacement))).andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("CONTENT_HAS_SUBMISSIONS"));
        var detail=tree(mvc.perform(get(base(destination)+"/"+id).header("Authorization",token(consultant))).andExpect(status().isOk()));
        mvc.perform(get(base(destination)).header("Authorization",token(consultant))).andExpect(status().isOk()).andExpect(jsonPath("$.items[0].questionCount").value(7));
        var copied=tree(postAs(programBase(destination,otherProgram)+"/sessions/"+otherSession+"/survey",consultant,detail.path("definition")).andExpect(status().isOk()));
        assertThat(copied.path("questions").get(0).path("id").asText()).isNotEqualTo(form.path("questions").get(0).path("id").asText());
        assertThat(copied.path("questions").get(6).path("options").toString()).isEqualTo("[\"Claridad\",\"Autenticidad\",\"Empatía\"]");
        tenant.activate(destination);assertThat(jdbcTemplate.queryForObject("select count(*) from rti.activity_evaluation_responses",Long.class)).isZero();
    }
    @Test void sessionTemplateCanCreateAnActivityFormAndKeepsItsSnapshotAfterSourceIsEdited()throws Exception{
        var source=tree(postAs(programBase(org,program)+"/sessions/"+session+"/survey",consultant,definition()).andExpect(status().isOk()));
        var saved=saveTemplate(source,"Cierre reutilizable");var id=saved.path("summary").path("id").asText();
        var edit=new java.util.HashMap<String,Object>(definition());edit.put("version",0);edit.put("title","Original modificado");
        postAs(programBase(org,program)+"/sessions/"+session+"/survey",consultant,edit).andExpect(status().isOk());
        var snapshot=tree(mvc.perform(get(base(destination)+"/"+id).header("Authorization",token(consultant))).andExpect(status().isOk())).path("definition");
        assertThat(snapshot.path("title").asText()).isEqualTo("Reflexiones reutilizables");
        var target=activity(destination,otherProgram,otherSession,1);
        postAs(programBase(destination,otherProgram)+"/activities/"+target.path("id").asText()+"/evaluation",consultant,snapshot).andExpect(status().isCreated())
            .andExpect(jsonPath("$.questions[5].type").value("SINGLE_CHOICE_LETTERS"));
    }
    @Test void deletingAnUnassignedSourceDoesNotDeleteItsReusableTemplate()throws Exception{
        var a=activity(org,program,session,1);var form=activityForm(a);var template=saveTemplate(form,"Conservar copia");
        postAs(programBase(org,program)+"/content/activities/"+a.path("id").asText()+"/delete",consultant,Map.of("version",0)).andExpect(status().isNoContent());
        mvc.perform(get(base(destination)+"/"+template.path("summary").path("id").asText()).header("Authorization",token(consultant))).andExpect(status().isOk())
            .andExpect(jsonPath("$.definition.questions.length()").value(7));
    }
    @Test void namesAreUniqueGloballyAndCatalogIsPaginatedDeterministically()throws Exception{
        var form=activityForm(activity(org,program,session,1));saveTemplate(form,"Mi plantilla");saveTemplate(form,"Otra plantilla");
        postAs(base(org),consultant,Map.of("sourceProgramId",program,"sourceEvaluationId",form.path("id").asText(),"name"," mi PLANTILLA "))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("QUESTIONNAIRE_TEMPLATE_NAME_EXISTS"));
        var first=tree(mvc.perform(get(base(destination)).param("size","1").header("Authorization",token(consultant))).andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.totalPages").value(2)));
        var second=tree(mvc.perform(get(base(destination)).param("size","1").param("page","1").header("Authorization",token(consultant))).andExpect(status().isOk()));
        assertThat(first.path("items").get(0).path("id").asText()).isNotEqualTo(second.path("items").get(0).path("id").asText());
        mvc.perform(get(base(org)).param("size","101").header("Authorization",token(consultant))).andExpect(status().isBadRequest());
    }
    @Test void sourceMustBelongToAuthorizedOrganizationAndGlobalCatalogIsConsultantOnly()throws Exception{
        var form=activityForm(activity(org,program,session,1));var template=saveTemplate(form,"Permisos");
        postAs(base(destination),consultant,Map.of("sourceProgramId",program,"sourceEvaluationId",form.path("id").asText(),"name","No copiar origen ajeno"))
            .andExpect(status().isNotFound());
        mvc.perform(get(base(org))).andExpect(status().isUnauthorized());
        for(var role:List.of("COLLABORATOR","LEADER","COMPANY_ADMIN")){
            tenant.activate(org);jdbcTemplate.update("update rti.membership_roles set role=? where membership_id=?",role,pm);
            mvc.perform(get(base(org)).header("Authorization",token(person))).andExpect(status().isForbidden());
            mvc.perform(get(base(org)+"/"+template.path("summary").path("id").asText()).header("Authorization",token(person))).andExpect(status().isForbidden());
            postAs(base(org),person,Map.of("sourceProgramId",program,"sourceEvaluationId",form.path("id").asText(),"name","No autorizado")).andExpect(status().isForbidden());
        }
    }
    @ParameterizedTest @ValueSource(strings={"update","delete"})
    void catalogSnapshotsAreImmutableForRuntimeDatabaseRole(String operation)throws Exception{
        var template=saveTemplate(activityForm(activity(org,program,session,1)),"Inmutable");
        var id=UUID.fromString(template.path("summary").path("id").asText());
        assertThatThrownBy(()->jdbcTemplate.update(operation.equals("update")?"update rti.questionnaire_templates set name='Cambio' where id=?":"delete from rti.questionnaire_templates where id=?",id))
            .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
    @Test void runtimeCannotInsertAProvenanceFromAnotherTenant()throws Exception{
        tenant.activate(org);
        assertThatThrownBy(()->jdbcTemplate.update("insert into rti.questionnaire_templates(source_organization_id,source_program_id,source_evaluation_id,created_by_user_id,name,snapshot) values(?,?,?,?,?,?::jsonb)",
            destination,otherProgram,uuid7(0xfff),consultant,"Provenance ajena","{}"))
            .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
    private String token(UUID user){
        var now=Instant.now();var claims=JwtClaimsSet.builder().issuer(TEST_COGNITO_ISSUER).subject("cognito-"+user).issuedAt(now).expiresAt(now.plusSeconds(300)).claim("token_use","access").claim("client_id",TEST_COGNITO_CLIENT_ID).build();
        return "Bearer "+encoder.encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).build(),claims)).getTokenValue();
    }
}
