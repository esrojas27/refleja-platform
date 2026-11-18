package com.reflejatuinterior.participation.application;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;

import com.reflejatuinterior.participation.domain.InvalidActivitySurveyResponse;

final class ActivityImageFormat {
    private static final int MAX_BYTES = 10 * 1024 * 1024;

    private ActivityImageFormat() {}

    static ActivityEvaluationResponses.Image validate(byte[] bytes) {
        if (bytes.length == 0 || bytes.length > MAX_BYTES) throw invalid();
        if (isWebp(bytes)) return new ActivityEvaluationResponses.Image("image/webp", bytes);
        try (var stream = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw invalid();
            var reader = readers.next();
            try {
                String type = switch (reader.getFormatName().toLowerCase(java.util.Locale.ROOT)) {
                    case "jpeg" -> "image/jpeg";
                    case "png" -> "image/png";
                    default -> throw invalid();
                };
                reader.setInput(stream, true, true);
                if (reader.getWidth(0) <= 0 || reader.getHeight(0) <= 0) throw invalid();
                return new ActivityEvaluationResponses.Image(type, bytes);
            } finally {
                reader.dispose();
            }
        } catch (IOException | IllegalArgumentException exception) {
            throw invalid();
        }
    }

    private static boolean isWebp(byte[] bytes) {
        if (bytes.length < 25 || !tag(bytes, 0).equals("RIFF") || !tag(bytes, 8).equals("WEBP")) return false;
        var size = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        if (Integer.toUnsignedLong(size.getInt(4)) + 8 != bytes.length) return false;
        boolean image = false;
        for (int offset = 12; offset < bytes.length;) {
            if (bytes.length - offset < 8) return false;
            long length = Integer.toUnsignedLong(size.getInt(offset + 4));
            long end = offset + 8L + length + (length & 1);
            if (end > bytes.length) return false;
            String chunk = tag(bytes, offset);
            int data = offset + 8;
            if (chunk.equals("VP8L") && length >= 5 && bytes[data] == 0x2f) image = true;
            if (chunk.equals("VP8 ") && length >= 10 && bytes[data + 3] == (byte) 0x9d
                    && bytes[data + 4] == 1 && bytes[data + 5] == 0x2a) image = true;
            offset = (int) end;
        }
        return image;
    }

    private static String tag(byte[] bytes, int start) {
        return new String(bytes, start, 4, StandardCharsets.US_ASCII);
    }

    private static InvalidActivitySurveyResponse invalid() {
        return new InvalidActivitySurveyResponse("answers");
    }
}
