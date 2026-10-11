FROM node:20-alpine AS dependencies

RUN apk add --no-cache bash git ca-certificates

WORKDIR /app
COPY package.json package-lock.json bower.json .bowerrc /app/
RUN npm ci
COPY . /app


FROM dependencies AS test

RUN npm test \
    && cd /app/test/e2e \
    && npm ci \
    && npm run test:static


FROM dependencies AS build

RUN npm run build:prod \
    && npm prune --omit=dev \
    && rm -rf /app/.git \
        /app/screenshots \
        /app/test \
        /app/test-results


FROM node:20-alpine AS runtime

RUN apk add --no-cache bash ca-certificates \
    && adduser -H -S -g "Konga service owner" -D -u 1200 -s /sbin/nologin konga

COPY --from=build /app /app

WORKDIR /app
RUN mkdir -p /app/kongadata /app/.tmp \
    && chown -R 1200:1200 /app/views /app/kongadata /app/.tmp

USER konga
EXPOSE 1337
VOLUME /app/kongadata

ENTRYPOINT ["/app/start.sh"]
