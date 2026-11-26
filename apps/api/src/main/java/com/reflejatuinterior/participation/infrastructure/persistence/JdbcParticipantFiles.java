package com.reflejatuinterior.participation.infrastructure.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.reflejatuinterior.participation.application.ParticipantFiles;
import com.reflejatuinterior.participation.application.ParticipantFileService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional(propagation = Propagation.MANDATORY)
class JdbcParticipantFiles implements ParticipantFiles {
    private final JdbcTemplate jdbc;
    JdbcParticipantFiles(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    @Override public List<Data> list(UUID org, UUID program, UUID enrollment) {
        return jdbc.query("""
            SELECT id,title,content_type,size_bytes,created_at FROM rti.participant_files
            WHERE organization_id=? AND program_id=? AND enrollment_id=? ORDER BY created_at DESC,id DESC
            """, (r,i) -> data(r), org,program,enrollment);
    }
    @Override public Data create(UUID org, UUID program, UUID enrollment, UUID actor, String title, String type, byte[] bytes) {
        // The service locks the enrollment; slots additionally enforce the ten-file cap in the database.
        var slots = jdbc.queryForList("""
            SELECT n FROM generate_series(1,10) n WHERE NOT EXISTS (
              SELECT 1 FROM rti.participant_files WHERE organization_id=? AND program_id=? AND enrollment_id=? AND slot=n)
            ORDER BY n LIMIT 1
            """, Integer.class,org,program,enrollment);
        if (slots.isEmpty()) throw new ParticipantFileService.LimitReached();
        return jdbc.queryForObject("""
            INSERT INTO rti.participant_files(id,organization_id,program_id,enrollment_id,slot,title,content_type,file_bytes,created_by)
            VALUES(?,?,?,?,?,?,?,?,?) RETURNING id,title,content_type,size_bytes,created_at
            """, (r,i) -> data(r),UUID.randomUUID(),org,program,enrollment,slots.getFirst(),title,type,bytes,actor);
    }
    @Override public Optional<Content> content(UUID org, UUID program, UUID enrollment, UUID file) {
        return jdbc.query("""
            SELECT id,title,content_type,size_bytes,created_at,file_bytes FROM rti.participant_files
            WHERE organization_id=? AND program_id=? AND enrollment_id=? AND id=?
            """, (r,i) -> new Content(data(r),r.getBytes("file_bytes")),org,program,enrollment,file).stream().findFirst();
    }
    @Override public boolean delete(UUID org, UUID program, UUID enrollment, UUID file) {
        return jdbc.update("DELETE FROM rti.participant_files WHERE organization_id=? AND program_id=? AND enrollment_id=? AND id=?",
                org,program,enrollment,file) == 1;
    }
    private static Data data(ResultSet r) throws SQLException {
        return new Data(r.getObject("id",UUID.class),r.getString("title"),r.getString("content_type"),r.getInt("size_bytes"),r.getTimestamp("created_at").toInstant());
    }
}
