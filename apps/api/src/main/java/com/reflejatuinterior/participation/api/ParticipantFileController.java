package com.reflejatuinterior.participation.api;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import com.reflejatuinterior.participation.application.ParticipantFileService;
import com.reflejatuinterior.participation.application.ParticipantFiles;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
class ParticipantFileController {
    private static final String BASE="/api/v1/organizations/{org}/programs/{program}/enrollments/{enrollment}/files";
    private final ParticipantFileService service;
    ParticipantFileController(ParticipantFileService service) { this.service=service; }
    @GetMapping("/api/v1/organizations/{org}/programs/{program}/files/participants")
    ResponseEntity<?> participants(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID org,@PathVariable UUID program,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return ok(service.participants(jwt.getSubject(),org,program,page,size));
    }
    @GetMapping(BASE)
    ResponseEntity<?> list(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID org,@PathVariable UUID program,@PathVariable UUID enrollment) {
        return ok(service.list(jwt.getSubject(),org,program,enrollment));
    }
    @PostMapping(path=BASE,consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<?> upload(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID org,@PathVariable UUID program,
            @PathVariable UUID enrollment,@RequestParam String name,@RequestPart MultipartFile file,HttpServletRequest request) throws IOException {
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore()).header("X-Request-ID",EnrollmentController.requestId(request))
            .body(service.upload(jwt.getSubject(),org,program,enrollment,name,file.getBytes(),EnrollmentController.requestId(request)));
    }
    @DeleteMapping(BASE+"/{file}")
    ResponseEntity<?> delete(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID org,@PathVariable UUID program,
            @PathVariable UUID enrollment,@PathVariable UUID file,HttpServletRequest request) {
        service.delete(jwt.getSubject(),org,program,enrollment,file,EnrollmentController.requestId(request));
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }
    @GetMapping(BASE+"/{file}/content")
    ResponseEntity<byte[]> content(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID org,@PathVariable UUID program,
            @PathVariable UUID enrollment,@PathVariable UUID file,@RequestParam(defaultValue="false") boolean download) {
        return binary(service.content(jwt.getSubject(),org,program,enrollment,file),download);
    }
    @GetMapping("/api/v1/me/programs/{program}/files")
    ResponseEntity<?> ownList(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID program) { return ok(service.ownList(jwt.getSubject(),program)); }
    @GetMapping("/api/v1/me/programs/{program}/files/{file}/content")
    ResponseEntity<byte[]> ownContent(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID program,@PathVariable UUID file,
            @RequestParam(defaultValue="false") boolean download) { return binary(service.ownContent(jwt.getSubject(),program,file),download); }
    private static ResponseEntity<?> ok(Object body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
    private static ResponseEntity<byte[]> binary(ParticipantFiles.Content content,boolean download) {
        var type=content.file().contentType();
        String extension=switch(type) { case "application/pdf" -> "pdf"; case "image/jpeg" -> "jpg"; case "image/png" -> "png"; default -> "webp"; };
        String name=content.file().title().replaceAll("[\\\\/:*?\"<>|]","_")+"."+extension;
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType(type))
            .contentLength(content.bytes().length).header("X-Content-Type-Options","nosniff")
            .header("Content-Security-Policy","sandbox; default-src 'none'")
            .header(HttpHeaders.CONTENT_DISPOSITION,(download?ContentDisposition.attachment():ContentDisposition.inline())
                .filename(name,StandardCharsets.UTF_8).build().toString()).body(content.bytes());
    }
}
