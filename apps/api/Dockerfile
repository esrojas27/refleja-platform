# syntax=docker/dockerfile:1.7

FROM maven:3.9.11-eclipse-temurin-21-alpine AS builder
WORKDIR /workspace
COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -ntp -DskipTests package && \
    cp target/api-0.0.1-SNAPSHOT.jar /tmp/app.jar

FROM eclipse-temurin:21-jre-alpine AS runtime
RUN addgroup -S -g 10001 rti && adduser -S -D -H -u 10001 -G rti rti
WORKDIR /app
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:InitialRAMPercentage=20 -XX:ActiveProcessorCount=2 -Djava.security.egd=file:/dev/urandom"
COPY --from=builder --chown=rti:rti /tmp/app.jar ./app.jar

USER rti
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
