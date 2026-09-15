package com.reflejatuinterior.program.domain;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

public record NewProgramActivity(String title, String instructions, String youtubeUrl,
        LocalDate dueDate, int position) {
    private static final Set<String> YOUTUBE_HOSTS = Set.of("youtube.com", "www.youtube.com", "m.youtube.com");
    private static final Set<String> YOUTUBE_NO_COOKIE_HOSTS =
            Set.of("youtube-nocookie.com", "www.youtube-nocookie.com");
    private static final Pattern VIDEO_ID = Pattern.compile("[A-Za-z0-9_-]{11}");

    public NewProgramActivity {
        if (title == null || title.isBlank() || title.length() > 255
                || title.codePoints().anyMatch(Character::isISOControl)) {
            throw new InvalidProgramInput("title");
        }
        title = title.strip();
        if (instructions == null || instructions.isBlank() || instructions.length() > 10000
                || instructions.indexOf('\0') >= 0) {
            throw new InvalidProgramInput("instructions");
        }
        instructions = instructions.strip();
        youtubeUrl = normalizeYoutubeUrl(youtubeUrl);
        if (dueDate == null || dueDate.getYear() < 1 || dueDate.getYear() > 9999) {
            throw new InvalidProgramInput("dueDate");
        }
        if (position < 1) throw new InvalidProgramInput("position");
    }

    private static String normalizeYoutubeUrl(String value) {
        if (value == null || value.isBlank()) return null;
        var normalized = value.strip();
        if (normalized.length() > 2048 || normalized.codePoints().anyMatch(Character::isISOControl)) {
            throw new InvalidProgramInput("youtubeUrl");
        }
        try {
            var uri = new URI(normalized);
            var host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getUserInfo() != null || uri.getPort() != -1) {
                throw new InvalidProgramInput("youtubeUrl");
            }
            if (host.equals("youtu.be") || host.equals("www.youtu.be")) {
                requireVideoPath(uri.getPath(), null);
            } else if (YOUTUBE_HOSTS.contains(host)) {
                if ("/watch".equals(uri.getPath())) requireWatchVideo(uri.getRawQuery());
                else requireVideoPath(uri.getPath(), Set.of("shorts", "embed", "live"));
            } else if (YOUTUBE_NO_COOKIE_HOSTS.contains(host)) {
                requireVideoPath(uri.getPath(), Set.of("embed"));
            } else {
                throw new InvalidProgramInput("youtubeUrl");
            }
            return normalized;
        } catch (URISyntaxException exception) {
            throw new InvalidProgramInput("youtubeUrl");
        }
    }

    private static void requireWatchVideo(String query) {
        if (query == null) throw new InvalidProgramInput("youtubeUrl");
        for (var parameter : query.split("&")) {
            var parts = parameter.split("=", 2);
            if (parts.length == 2 && parts[0].equals("v") && VIDEO_ID.matcher(parts[1]).matches()) return;
        }
        throw new InvalidProgramInput("youtubeUrl");
    }

    private static void requireVideoPath(String path, Set<String> allowedPrefixes) {
        var segments = path == null ? new String[0] : path.split("/");
        var valid = allowedPrefixes == null
                ? segments.length == 2 && VIDEO_ID.matcher(segments[1]).matches()
                : segments.length == 3 && allowedPrefixes.contains(segments[1])
                        && VIDEO_ID.matcher(segments[2]).matches();
        if (!valid) throw new InvalidProgramInput("youtubeUrl");
    }
}
