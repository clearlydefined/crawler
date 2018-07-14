# Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
# SPDX-License-Identifier: MIT

#FROM node:8-alpine # switch back to node:8-alpine after removing Scancode
FROM node:8
ENV APPDIR=/opt/service
#RUN apk update && apk upgrade && \
#    apk add --no-cache bash git openssh

# Scancode
RUN curl -sL https://github.com/nexB/scancode-toolkit/releases/download/v2.9.2/scancode-toolkit-2.9.2.tar.bz2 | tar -C /opt -jx \
  && /opt/scancode-toolkit-2.9.2/scancode --version
ENV SCANCODE_HOME=/opt/scancode-toolkit-2.9.2

# FOSSology
WORKDIR /opt
RUN git clone https://github.com/fossology/fossology.git

WORKDIR /opt/fossology/src/nomos/agent
RUN make -f Makefile.sa
ENV FOSSOLOGY_HOME=/opt/fossology/src/nomos/agent

COPY package*.json /tmp/
RUN cd /tmp && npm install --production
RUN mkdir -p "${APPDIR}" && cp -a /tmp/node_modules "${APPDIR}"

WORKDIR "${APPDIR}"
COPY . "${APPDIR}"

ENV PORT 4000
EXPOSE 4000
ENTRYPOINT ["npm", "start"]
