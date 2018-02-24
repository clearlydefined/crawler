// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const vsts = require('vso-node-api');

class VstsBuild {
  constructor(options) {
    this.options = options.vsts;
    this.crawlerRequestUrl = options.crawlerUrl + '/requests';
    this.crawlerAuthToken = options.crawlerAuthToken;
    if (!this.options.apiToken) {
      throw new Error('VSTS build API token must be provided.');
    }
    const authHandler = vsts.getPersonalAccessTokenHandler(this.options.apiToken);
    this.connection = new vsts.WebApi(this.options.collectionUrl, authHandler);
  }

  async queueBuild(request, spec) {
    const vstsBuild = await this.connection.getBuildApi();
    const definitions = await vstsBuild.getDefinitions(this.options.project, this.options.definitionName);
    let definitionId = definitions && definitions[0] ? definitions[0].id : null;
    if (!definitionId) {
      definitionId = (await vstsBuild.createDefinition(this._buildDefinition, this.options.project)).id;
    }
    const build = {
      definition: {
        id: definitionId
      },
      parameters: JSON.stringify({
        sourceUrl: `https://github.com/${spec.namespace}/${spec.name}.git`,
        sourceCommit: spec.revision,
        callbackCommand: this._getCallbackCommand(request.url),
        request: JSON.stringify(JSON.stringify({ type: request.type, url: request.url, context: request.context }))
      })
    };
    return await vstsBuild.queueBuild(build, this.options.project);
  }

  _getCallbackCommand(requestUrl) {
    const body = JSON.stringify({
      type: 'ingest-vsts',
      url: requestUrl,
      payload: {
        body: {
          toolVersion: '__TOOL_VERSION__', // will be replaced by VSTS build
          buildOutput: '__DOWNLOAD_URL__' // will be replaced by VSTS build
        }
      }
    });
    return `curl ${this.crawlerRequestUrl} -X POST -d ${JSON.stringify(body)} --header "Content-Type:application/json" --header "X-token:__CRAWLER_AUTH_TOKEN__"`; // __CRAWLER_AUTH_TOKEN__ will be replaced by VSTS build
  }

  get _buildDefinition() {
    return {
      name: this.options.definitionName,
      path: '\\tools',
      repository: {
        name: this.options.project,
        url: this.options.emptyRepoUrl,
        type: 'TfsGit'
      },
      buildNumberFormat: '$(date:yyyyMMdd)$(rev:.r)',
      jobAuthorizationScope: 'projectCollection',
      jobTimeoutInMinutes: 60,
      queue: {
        name: 'Hosted Linux Preview'
      },
      queueStatus: 'enabled',
      type: 'build',
      variables: {
        callbackCommand: {
          value: '',
          allowOverride: true
        },
        sourceCommit: {
          value: '',
          allowOverride: true
        },
        sourceUrl: {
          value: '',
          allowOverride: true
        },
        request: {
          value: '',
          allowOverride: true
        },
        authToken: {
          value: this.crawlerAuthToken
        }
      },
      process: {
        phases: [
          {
            steps: [
              {
                enabled: true,
                continueOnError: true,
                displayName: 'Run scancode image',
                refName: 'Docker1',
                task: {
                  id: 'e28912f1-0114-4464-802a-a3a35437fd16',
                  definitionType: 'task'
                },
                inputs: {
                  containerregistrytype: 'Azure Container Registry',
                  azureSubscriptionEndpoint: this.options.azureSubscriptionEndpoint,
                  azureContainerRegistry: JSON.stringify(this.options.azureContainerRegistry),
                  action: 'Run an image',
                  imageName: 'clearlydefined/tool-images/scancode:latest',
                  qualifyImageName: 'true',
                  volumes: '$(Agent.BuildDirectory):/output',
                  envVars: 'SOURCE_URL=$(sourceUrl)\nSOURCE_COMMIT=$(sourceCommit)\nCALLBACK_COMMAND=$(callbackCommand)',
                  detached: 'false',
                  restartPolicy: 'no'
                }
              },
              {
                enabled: true,
                displayName: 'Request recorder',
                refName: 'ShellScript1',
                task: {
                  id: '6c731c3c-3c68-459a-a5c9-bde6e6595b5b',
                  versionSpec: '3.*',
                  definitionType: 'task'
                },
                inputs: {
                  targetType: 'inline',
                  script: 'mkdir $(Agent.BuildDirectory)/output\necho $(request) > $(Agent.BuildDirectory)/output/request.json\n'
                }
              },
              {
                enabled: true,
                displayName: 'Error checker',
                refName: 'ShellScript1',
                task: {
                  id: '6c731c3c-3c68-459a-a5c9-bde6e6595b5b',
                  versionSpec: '3.*',
                  definitionType: 'task'
                },
                inputs: {
                  targetType: 'inline',
                  script: '#mkdir $(Agent.BuildDirectory)/output\n\nif [ -f $(Agent.BuildDirectory)/scancode.json ]\nthen\n    mv $(Agent.BuildDirectory)/scancode.json $(Agent.BuildDirectory)/output/scancode.json\nelse\n    ERRORED_TASK_URL=$SYSTEM_TASKDEFINITIONSURI$SYSTEM_TEAMPROJECT/_apis/build/builds/$BUILD_BUILDID/logs/4\n    echo \"{\\\"error\\\":\\\"scancode failed $ERRORED_TASK_URL\\\"}\" > $(Agent.BuildDirectory)/output/error.json\nfi'
                }
              },
              {
                enabled: true,
                displayName: 'Publish Artifact: output',
                refName: 'PublishBuildArtifacts1',
                task: {
                  id: '2ff763a7-ce83-4e1f-bc89-0ae63477cebe',
                  definitionType: 'task'
                },
                inputs: {
                  PathtoPublish: '$(Agent.BuildDirectory)/output',
                  ArtifactName: 'output',
                  ArtifactType: 'Container',
                  TargetPath: '\\\\my\\share\\$(Build.DefinitionName)\\$(Build.BuildNumber)'
                }
              },
              {
                enabled: true,
                displayName: 'Execute callback command',
                refName: 'ShellScript1',
                task: {
                  id: '6c731c3c-3c68-459a-a5c9-bde6e6595b5b',
                  versionSpec: '3.*',
                  definitionType: 'task'
                },
                inputs: {
                  targetType: 'inline',
                  script: 'BUILD_ARTIFACT_URL=\"$SYSTEM_TASKDEFINITIONSURI$SYSTEM_TEAMPROJECT/_apis/build/builds/$BUILD_BUILDID/artifacts?artifactName=output&%24format=zip\"\necho Build artifact URL: $BUILD_ARTIFACT_URL\nCALLBACK_COMMAND=\"$(callbackCommand)\"\n# Substitute __DOWNLOAD_URL__, __TOOL_VERSION__ and __CRAWLER_AUTH_TOKEN__ tokens with the actual values and call the callback command::\nCALLBACK_COMMAND=${CALLBACK_COMMAND//__DOWNLOAD_URL__/$BUILD_ARTIFACT_URL}\nCALLBACK_COMMAND=${CALLBACK_COMMAND//__TOOL_VERSION__/2.2.1}\necho Callback to execute: $CALLBACK_COMMAND\nCALLBACK_COMMAND=${CALLBACK_COMMAND//__CRAWLER_AUTH_TOKEN__/$(authToken)}\n$CALLBACK_COMMAND'
                }
              }
            ]
          }
        ]
      }
    };
  }
}

module.exports = VstsBuild;