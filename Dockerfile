# Copyright (c) Microsoft Corporation. All rights reserved.
# SPDX-License-Identifier: MIT

FROM node:6-alpine
ENV APPDIR=/opt/service
RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh curl build-base libgit2-dev python tzdata pkgconfig

COPY package.json /tmp/package.json
RUN cd /tmp && npm install --production
RUN mkdir -p "${APPDIR}" && cp -a /tmp/node_modules "${APPDIR}"

WORKDIR "${APPDIR}"
COPY . "${APPDIR}"

ENV PORT 4000
EXPOSE 4000
ENTRYPOINT ["npm", "start"]
