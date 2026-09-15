ALTER TABLE rti.program_sessions
    ADD COLUMN objective TEXT;

UPDATE rti.program_sessions
SET objective = description
WHERE description IS NOT NULL;

ALTER TABLE rti.program_sessions
    ADD CONSTRAINT ck_program_sessions_objective_length
        CHECK (objective IS NULL OR char_length(objective) <= 10000);

ALTER TABLE rti.program_activities
    ADD COLUMN youtube_url VARCHAR(2048),
    ADD CONSTRAINT ck_program_activities_youtube_url
        CHECK (
            youtube_url IS NULL
            OR youtube_url ~ '^https://(www\.)?youtu\.be/[A-Za-z0-9_-]{11}([?#].*)?$'
            OR youtube_url ~ '^https://((www|m)\.)?youtube\.com/watch\?[^#]*v=[A-Za-z0-9_-]{11}(&[^#]*)?(#.*)?$'
            OR youtube_url ~ '^https://((www|m)\.)?youtube\.com/(shorts|embed|live)/[A-Za-z0-9_-]{11}([?#].*)?$'
            OR youtube_url ~ '^https://(www\.)?youtube-nocookie\.com/embed/[A-Za-z0-9_-]{11}([?#].*)?$'
        );
