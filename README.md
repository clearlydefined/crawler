# ClearlyDefined crawler

A service that crawls projects and packages for information relevant to ClearlyDefined.

# Quick start

1.  Clone this repo
1.  `cd` to the repo dir and run `npm install`
1.  Copy the `template.env.json` file to the **parent** directory of the repo and rename it to `env.json`. Ideally this repo is colocated with the other ClearlyDefined repos. You can share the `env.json` file. Just merge the two files. Some properties are meant to be shared.
1.  After copying/merging, update the file to have the property values for your system. See the [Configuration](#configuration) section for more details.
1.  Install [ScanCode](https://github.com/nexB/scancode-toolkit) if desired.
1.  Run `npm start`

That results in the ClearlyDefined crawler starting up and listening for POSTs on port 5000. See the [Configuration](#configuration) section for info on how to change the port.

## Queuing work with the crawler

The crawler takes _requests_ to rummage around and find relevant information about projects. For example, to crawl an NPM, or a GitHub repo, POST one of the following JSON bodies to `http://localhost:5000/requests`. Note that you can also queue an array of requests by POSTing a JSON array of request objects. Be sure to include the following headers in your request:

- `content-type: application/json`
- `X-token: <your token>` - set the value here the same as you put in your `env.json`'s `CRAWLER_SERVICE_AUTH_TOKEN` property or `secret` if you did not set the env value.

```json
{
  "type": "npm",
  "url": "cd:/npm/npmjs/-/redie/0.3.0"
}
```

```json
{
  "type": "git",
  "url": "cd:/git/github/Microsoft/redie/194269b5b7010ad6f8dc4ef608c88128615031ca"
}
```

The request `type` describes the crawling activity being requested. For example, "do `npm` crawling". It is typically the same as the `type` in the url (see below). There are some more advanced scenarios where the two values are different but for starters, treat them as the same.

The general form of a request URL is (note: it is a URL because of the underlying crawling infrastructure, the `cd` scheme is not particularly relevant)

```
cd:/type/provider/namespace/name/revision
```

Where the segments are:

- type -- the type of the component to be crawled. For exammple, npm, git, nuget, maven, ... This talks about the _shape_ of the component.
- provider -- where the component can be found. Examples include npmjs, mavenCentral, github, nuget, ...
- namespace -- many component systems have namespaces. GitHub orgs, NPM namespace, Maven group id, ... This segment must be supplied. If your component does not have a namespace, use '-' (ASCII hyphen).
- name -- the name of the component you want to crawl. Given the `namespace` segment mentioned above, this is just the simple name.
- revision -- components typically have some differentiator like a version or commit id. Use that here. If this segment is omitted, the latest revision is used (if that makes sense for the provider).

Given a request, the crawler does the following kinds of things (it does more or less work depending on the details found in its travels and the set of tools configured):

1.  Looking up the package at npmjs.com and pull out interesting bits like the project location, issue tracker, and most importantly, the source code location.
1.  With the source location, the crawler determines the revision (e.g., Git commit) that matches the version of the package.
1.  Given the location and revision, the crawler fetches the source and runs any configured scan tools (e.g., ScanCode)

The crawler's output is stored for use by the rest of the ClearlyDefined infrastructure -- it is not intended to be used directly by humans.

# Configuration

The crawler is quite configuable. Out of the box it is setup for demo-level use directly on your computer. In its full glory it can run with arbitrarily many distributed clients using an array of different queuing, caching and storage technologies.

Without any further configuration the crawler uses/supports:

- In memory queuing. When you stop the crawler, it forgets any pending work
- Local filesystem-based storage. All outputs are stored in a configurable location on your machine. By default this is `c:\temp\cd` (for Windows) and `/tmp/cd` (for all other systems). You can change this setting using the `FILE_STORE_LOCATION` property in the `env.json` file you copied during setup.
- GitHub source location discovery.
- NPM package traversal.

The following sections spell out how to configure, run and control the crawler. Keep in mind that the ClearlyDefined crawler is based on the GHCrawler. That system focuses on crawling the GitHub APIs in an effort to understand that state of and interaction around projects. We are using a branch of GHCrawler that carves out the generic API crawling function from the specifics of crawling GitHub. The detailed doc in the GHCrawler wiki applies here though some of the nitty gritty may vary. Over time, we'll update this doc to be more directly applicable.

## Properties

### FILE_STORE_LOCATION

This is the location to store harvested data, scan results, ... If left unset, data will be stored in `c:\temp\cd` (for Windows) and `/tmp/cd` (for all other systems). This location is shared with other parts of the system.

### SCANCODE_HOME

The directory where ScanCode is installed. If you don't set this, running ScanCode will be skipped.

### CRAWLER_GITHUB_TOKEN

The crawler tries to figure out details of the packages and source being traversed using various GitHub API calls. For this it needs an API token. This can be a Personal Access Token (PAT) or the token for an OAuth App. The token does not need any special permissions, only public data is accessed. Without this key GitHub will severely rate limit the crawler (as it should) and you won't get very far.

# Docker

## Run Docker image from Docker Hub

`docker run --env-file ../<env_name>.env.list clearlydefined/crawler`

See `local.env.list`, `dev.env.list` and `prod.env.list` tempate files.

`HARVEST_AZBLOB_CONNECTION_STRING` can be either an account key-based connection string or a Shared Access Signature (SAS) connection string. SAS connection string must be generated from `clearlydefinedprod` storage account with the following minimal set of permissions:

- Allowed services: Blob, Queue
- Allowed resource types: Container, Object
- Allowed permissions: Read, Write, Add, Process

## Build and run Docker image locally

`docker build -t crawler .`

`docker run --rm --env-file ../local.env.list -p 5000:5000 crawler`

# ClearlyDefined, defined.

## Mission

Help FOSS projects be more successful through clearly defined project data.

For more details on the project, check out the [wiki](../../../clearlydefined/wiki).

# Contributing

This project welcomes contributions and suggestions, and we've documented the details of contribution policy [here](CONTRIBUTING.md).

The [Code of Conduct](CODE_OF_CONDUCT.md) for this project is details how the community interacts in
an inclusive and respectful manner. Please keep it in mind as you engage here.
