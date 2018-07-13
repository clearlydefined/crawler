// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// Copyright (c) 2018, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const requestRetry = require('requestretry').defaults({ maxAttempts: 3, fullResponse: true })
const nodeRequest = require('request')
const fs = require('fs')
const { findLastKey, get, find } = require('lodash')

const providerMap = {
  launchpad: 'https://api.launchpad.net/1.0/'
}
class LaunchpadFetch extends BaseHandler {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'launchpad'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    const registryData = await this._getRegistryData(spec)
    const revisionData = spec.series && spec.revision ? await this._getRevision(spec) : null
    request.url = spec.toUrl()
    const file = this._createTempFile(request)
    await this._getPackage(revisionData)
    const dir = this._createTempDir(request)
    await this.decompress(file.name, dir.name)
    request.document = await this._createDocument(dir, spec, registryData)
    request.contentOrigin = 'origin'
    return request
  }

// {"license_info": null, "remote_product": "ubuntu/+source/unity", "recipes_collection_link": "https://api.launchpad.net/1.0/unity/recipes", "development_focus_link": "https://api.launchpad.net/1.0/unity/trunk", "bug_supervisor_link": "https://api.launchpad.net/1.0/~unity-team", "private": false, "registrant_link": "https://api.launchpad.net/1.0/~tired-gin", "official_bug_tags": ["bitesize", "dash", "dnd", "hidpi", "indicators", "launcher", "lim", "lockscreen", "multimonitor", "needs-design", "new-decorations", "panel", "patch", "regression", "rls-w-incoming", "rls-x-incoming", "rls-y-icoming", "shortcut", "shortcuts", "spread", "switcher", "theme", "u7-trello-import", "ubuntukylin", "unity-backlog", "unity-panel-service", "workspace"], "active_milestones_collection_link": "https://api.launchpad.net/1.0/unity/active_milestones", "commercial_subscription_is_due": false, "translation_focus_link": "https://api.launchpad.net/1.0/unity/trunk", "licenses": ["GNU GPL v3", "GNU LGPL v3"], "all_milestones_collection_link": "https://api.launchpad.net/1.0/unity/all_milestones", "bug_reporting_guidelines": "If you are using Ubuntu please don't report the bug from here, rather open a terminal and type 'ubuntu-bug unity' then follow the onscreen instructions and the process will take you directly to launchpad to report the issue but this time we will have a lot of information about your system in the bug report and you will probably not be requested to provide any further information afterwards.", "bug_reported_acknowledgement": null, "display_name": "Unity", "wiki_url": null, "title": "Unity", "homepage_url": null, "download_url": null, "name": "unity", "is_permitted": "tag:launchpad.net:2008:redacted", "vcs": "Bazaar", "reviewer_whiteboard": "tag:launchpad.net:2008:redacted", "self_link": "https://api.launchpad.net/1.0/unity", "information_type": "Public", "resource_type_link": "https://api.launchpad.net/1.0/#project", "programming_language": "c, c++, vala", "description": "Unity is a desktop experience that sings. Designed by Canonical and the Ayatana community, Unity is all about the combination of familiarity and the future. We bring together visual design, analysis of user experience testing, modern graphics technologies and a deep understanding of the free software landscape to produce what we hope will be the lightest, most elegant and most delightful way to use your PC.\n\nUnity is free software, you are encouraged to use whatever pieces of it suit you. We discuss its evolution on the Ayatana mailing lists for developers and designers. We embrace the values of GNOME: simplicity, style, usability and accessibility, and we embrace professional, considered design thinking.\n\nThe Unity desktop experience is designed to allow for multiple implementations, currently, Unity consists of a Compiz plugin based visual interface only, which is heavily dependent on OpenGL.\n", "project_reviewed": "tag:launchpad.net:2008:redacted", "brand_link": "https://api.launchpad.net/1.0/unity/brand", "sourceforge_project": null, "http_etag": "\"159a39b493f8153d7bce7a66b703d46b17c0b54d-06e41aa23094d8142642a9c61078cd1502c28d8b\"", "project_group_link": "https://api.launchpad.net/1.0/ayatana", "date_created": "2009-06-09T09:03:17.118544+00:00", "active": true, "private_bugs": false, "bug_tracker_link": null, "security_contact": null, "license_approved": "tag:launchpad.net:2008:redacted", "driver_link": "https://api.launchpad.net/1.0/~unity-team", "freshmeat_project": null, "screenshots_url": null, "web_link": "https://launchpad.net/unity", "summary": "Unity: A desktop experience designed for efficiency of space and interaction.", "logo_link": "https://api.launchpad.net/1.0/unity/logo", "owner_link": "https://api.launchpad.net/1.0/~pspmteam", "qualifies_for_free_hosting": true, "releases_collection_link": "https://api.launchpad.net/1.0/unity/releases", "date_next_suggest_packaging": null, "series_collection_link": "https://api.launchpad.net/1.0/unity/series", "commercial_subscription_link": null, "icon_link": "https://api.launchpad.net/1.0/unity/icon"}

  async _getRegistryData(spec) {
    const baseUrl = providerMap.launchpad
    const { body, statusCode } = await requestRetry.get(`${baseUrl}${spec.name}`, {
      json: true
    })
    if (statusCode !== 200 || !body) return null
    return body
  }

   // releases from https://api.launchpad.net/1.0/unity/releases
   // {"total_size": 97, "start": 0, "next_collection_link": "https://api.launchpad.net/1.0/unity/releases?ws.size=75\u0026memo=75\u0026ws.start=75", "entries": [{"display_name": "Unity 2010-06-03", "changelog": null, "release_notes": null, "files_collection_link": "https://api.launchpad.net/1.0/unity/0.2/2010-06-03/files", "title": "Unity 2010-06-03 \"0.2.6\"", "web_link": "https://launchpad.net/unity/0.2/2010-06-03", "project_link": "https://api.launchpad.net/1.0/unity", "milestone_link": "https://api.launchpad.net/1.0/unity/+milestone/2010-06-03", "http_etag": "\"bea0724a63d7913cd1a838ba5d9fdfaa46219da0-b29bf1e3d102a737c5ab679f02a1bd84142a54c5\"", "owner_link": "https://api.launchpad.net/1.0/~njpatel", "version": "2010-06-03", "self_link": "https://api.launchpad.net/1.0/unity/0.2/2010-06-03", "date_created": "2010-06-07T10:15:56.635667+00:00", "date_released": "2010-06-07T10:15:00+00:00", "resource_type_link": "https://api.launchpad.net/1.0/#project_release"}, 

   // files from https://api.launchpad.net/1.0/unity/0.2/2010-06-03/files
   // {"total_size": 2, "start": 0, "entries": [{"description": "0.2.7", "file_type": "Code Release Tarball", "resource_type_link": "https://api.launchpad.net/1.0/#project_release_file", "project_release_link": "https://api.launchpad.net/1.0/unity/0.2/2010-06-03", "signature_link": "https://api.launchpad.net/1.0/unity/0.2/2010-06-03/+file/unity-0.2.7.tar.gz/signature", "http_etag": "\"15b0743c480fec92ccb097763634e36adc7189d3-e5b8dea93b683ae4f8048863380ae79cdbae335f\"", "self_link": "https://api.launchpad.net/1.0/unity/0.2/2010-06-03/+file/unity-0.2.7.tar.gz", "file_link": "https://api.launchpad.net/1.0/unity/0.2/2010-06-03/+file/unity-0.2.7.tar.gz/file", "date_uploaded": "2010-06-08T09:47:05.170140+00:00"}, {"description": "0.2.6", "file_type": "Code Release Tarball", "resource_type_link": "https://api.launchpad.net/1.0/#project_release_file", "project_release_link": "https://api.launchpad.net/1.0/unity/0.2/2010-06-03", "signature_link": "https://api.launchpad.net/1.0/unity/0.2/2010-06-03/+file/unity-0.2.6.tar.gz/signature", "http_etag": "\"9ff5cbd7e8aebff0986f98bd4385716591bb8eb4-5c392eb7272c8fbc0aadc0effa98ce888a196841\"", "self_link": "https://api.launchpad.net/1.0/unity/0.2/2010-06-03/+file/unity-0.2.6.tar.gz", "file_link": "https://api.launchpad.net/1.0/unity/0.2/2010-06-03/+file/unity-0.2.6.tar.gz/file", "date_uploaded": "2010-06-07T10:16:19.880961+00:00"}], "resource_type_link" : "https://api.launchpad.net/1.0/#project_release_file-page-resource"}

  async _getRevision(registryData) {
    const baseUrl = providerMap.launchpad
    const { body, statusCode } = await requestRetry.get(`${baseUrl}${spec.name}/${spec.series}/${spec.revision}`);
    if (statusCode !== 200 || !body) return null
    return body
  }

  _createDocument(dir, spec, registryData, revisionData) {
    const releaseDate = this._extractReleaseDate(spec, revisionData)
    return { location: dir.name, registryData, revisionData, releaseDate }
  }

  //{"display_name": "Unity 2010-06-03", "changelog": null, "release_notes": null, "files_collection_link": "https://api.launchpad.net/1.0/unity/0.2/2010-06-03/files", "title": "Unity 2010-06-03 \"0.2.6\"", "web_link": "https://launchpad.net/unity/0.2/2010-06-03", "project_link": "https://api.launchpad.net/1.0/unity", "milestone_link": "https://api.launchpad.net/1.0/unity/+milestone/2010-06-03", "http_etag": "\"bea0724a63d7913cd1a838ba5d9fdfaa46219da0-b29bf1e3d102a737c5ab679f02a1bd84142a54c5\"", "owner_link": "https://api.launchpad.net/1.0/~njpatel", "version": "2010-06-03", "self_link": "https://api.launchpad.net/1.0/unity/0.2/2010-06-03", "date_created": "2010-06-07T10:15:56.635667+00:00", "date_released": "2010-06-07T10:15:00+00:00", "resource_type_link": "https://api.launchpad.net/1.0/#project_release"}

  _extractReleaseDate(spec, revisionData) {
    return revisionData ? revisionData.date_released : null
  }

  async _getPackage(spec, revisionData, destination) {
    const release = find(files.entries, entry => {
      return entry.file_type === 'Code Release Tarball'
    })
    if (!release) return
    return new Promise((resolve, reject) => {
      nodeRequest
        .get(release.file_link, (error, response) => {
          if (error) return reject(error)
          if (response.statusCode !== 200) reject(new Error(`${response.statusCode} ${response.statusMessage}`))
        })
        .pipe(fs.createWriteStream(destination).on('finish', () => resolve(null)))
    })
  }
}

module.exports = options => new LaunchpadFetch(options)
