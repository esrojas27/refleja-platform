package com.reflejatuinterior.identity.infrastructure.aws;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/** Offline preview of the actual renderer. Does not create users or send mail. */
public final class WelcomeEmailPreview {
    private WelcomeEmailPreview() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("Pass the preview output directory.");
        Path output = Path.of(args[0]);
        Files.createDirectories(output);
        String accessUrl = "https://rti-dev.18-210-172-252.nip.io/invitations";
        Files.writeString(output.resolve("Bienvenida_IFX.html"), CollaboratorWelcomeEmail.html("Ana Martínez", accessUrl), StandardCharsets.UTF_8);
        Files.writeString(output.resolve("Bienvenida_IFX.txt"), CollaboratorWelcomeEmail.text("Ana Martínez", accessUrl), StandardCharsets.UTF_8);
    }
}
