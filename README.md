# ClearlyDefined crawler

A service that crawls projects and packages for information relevant to ClearlyDefined. Typically users do not need to directly interact with the crawler. Rather, you would use the ClearlyDefined service API to queue "harvesting" of more component's data. It can be convenient to run the crawler directly if, for example, you are developing a handler for a new package type.

# Quick start

1.  Clone this repo
1.  `cd` to the repo dir and run `npm install`
1.  Copy the `template.env.json` file to the **parent** directory of the repo and rename it to `env.json`. Ideally this repo is colocated with the other ClearlyDefined repos. You can share the `env.json` file. Just merge the two files. Some properties are meant to be shared.
1.  After copying/merging, update the file to have the property values for your system. See the [Configuration](#configuration) section for more details.
1.  Install [ScanCode](https://github.com/nexB/scancode-toolkit) if desired (see below).
1.  Run `npm start`

That results in the ClearlyDefined crawler starting up and listening for POSTs on port 5000. See the [Configuration](#configuration) section for info on how to change the port.

### ScanCode install notes

Due to an issue with ScanCode's install configuration on Windows, you may need to **replace** the `bin` folder (actually a "junction") with the contents of the `Scripts` folder. That is, delete `bin` and copy `Scripts` to `bin`. See https://github.com/nexB/scancode-toolkit/issues/1129 for more details.

## Queuing work with the crawler

The crawler takes _requests_ to rummage around and find relevant information about projects. For example, to crawl an NPM, or a GitHub repo, POST one of the following JSON bodies to `http://localhost:5000/requests`. Note that you can also queue an array of requests by POSTing a single (or array of) JSON request object. For example,

```
curl -d '{"type":"npm", "url":"cd:/npm/npmjs/-/redie/0.3.0"}' -H "Content-Type: application/json" -H "X-token: secret" -X POST http://localhost:5000/requests
```

Be sure to include the following headers in your request:

- `content-type: application/json`
- `X-token: <your token>` - set the value here the same as you put in your `env.json`'s `CRAWLER_SERVICE_AUTH_TOKEN` property or `secret` if you did not set the env value.

Here are a few example request objects.

```json
{
  "type": "package",
  "url": "cd:/npm/npmjs/-/redie/0.3.0"
}
```

```json
{
  "type": "source",
  "url": "cd:/git/github/Microsoft/redie/194269b5b7010ad6f8dc4ef608c88128615031ca"
}
```

The request `type` describes the crawling activity being requested. For example, "do `package` crawling". It is typically the same as the `type` in the url (see below). There are some more advanced scenarios where the two values are different but for starters, treat them as the same. The general form of a request URL is (note: it is a URL because of the underlying crawling infrastructure, the `cd` scheme is not particularly relevant)

```
cd:/type/provider/namespace/name/revision
```

Where the segments are:

- type -- the type of the component to be crawled. For example, npm, git, nuget, maven, ... This talks about the _shape_ of the component.
- provider -- where the component can be found. Examples include npmjs, mavenCentral, github, nuget, ...
- namespace -- many component systems have namespaces. GitHub orgs, NPM namespace, Maven group id, ... This segment must be supplied. If your component does not have a namespace, use '-' (ASCII hyphen).
- name -- the name of the component you want to crawl. Given the `namespace` segment mentioned above, this is just the simple name.
- revision -- components typically have some differentiator like a version or commit id. Use that here. If this segment is omitted, the latest revision is used (if that makes sense for the provider).

Given a request, the crawler does the following kinds of things (it does more or less work depending on the details found in its travels and the set of tools configured):

Process the component:

1.  Look up the component in its registry (e.g., npmjs.com) and pull out interesting bits like the project location, issue tracker, release date, and most importantly, the source code location where possible.
1.  Run tools like ScanCode and others if they are likely to find anything interesting given the component type

Process the source, if any:

1.  The crawler determines the revision (e.g., Git commit) that matches the version of the package.
1.  Given the location and revision, the crawler fetches the source and runs any configured scan tools (e.g., ScanCode)

The crawler's output is stored for use by the rest of the ClearlyDefined infrastructure -- it is not intended to be used directly by humans. Note that each tool's output is stored separately and the results of processing the component and the component source are also separated.

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

### CRAWLER_HOST

Used to identify a whole group of deployments. A friendly human-readable string.

### CRAWLER_ID

An optional setting. If not specified, a uuid will be generated for each instance.
If a CRAWLER_ID is specified, then each instance must have this setting globally unique.

# Docker

## Run Docker image from Docker Hub

You can run the image as is from docker (this is w/o any port forwarding, which means the only way you can interact with the crawler locally is through the queue. See below for examples of how to run with ports exposed to do curl based testing).
`docker run --env-file ../<env_name>.env.list clearlydefined/crawler`

See `local.env.list`, `dev.env.list` and `prod.env.list` tempate files.

`CRAWLER_AZBLOB_CONNECTION_STRING` can be either an account key-based connection string or a Shared Access Signature (SAS) connection string. SAS connection string must be generated from `clearlydefinedprod` storage account with the following minimal set of permissions:

- Allowed services: Blob, Queue
- Allowed resource types: Container, Object
- Allowed permissions: Read, Write, List, Add, Process

## Build and run Docker image locally

`docker build -t cdcrawler:latest .`

`docker run --rm --env-file ../dev.env.list -p 5000:5000 -p 9229:9229 cdcrawler:latest`

With a debugger:

`docker run --rm -d --env-file ../dev.env.list -p 9229:9229 -p 5000:5000 --entrypoint npm cdcrawler:latest run local`

At this point you can attach VS Code with the built in debugging profile (see .vscode/launch.json)

# Clouds

## Google Cloud

This uses GKE (Google Kubernetes Engine). The instructions are applicable to
normal Kubernetes as well (minus anything mentioning gcloud.)

`-n dev` sets the Kubernetes namespace for an action. For prod, use `-n prod`.

### Environment Setup

One time setup to make kubectl work:

    gcloud --project <project> container clusters get-credentials <gke cluster>
    --region <region>

Setup namespaces:

    kubectl create namespace prod
    kubectl create namespace dev

Configure secrets:

    go run tools/env2kubesecrets.go < dev.env.list | \
      kubectl -n dev apply -f -

### Launch/Update

Launch crawler and redis:

    kubectl -n dev apply -f crawler.yaml

To trigger a reload of a new image with the same labels (but without changing
any other configs.)

    kubectl patch -n dev deployment crawler -p \
        "{\"spec\":{\"template\":{\"metadata\":{\"labels\":{\"date\":\"`date +'%s'`\"}}}}}"

(This is a hack to force a restart, and the `ImagePullPolicy: always` is what
will trigger fetching the new image.)

### Scaling

Create a HorizontalPodAutoscaler with:

```
kubectl autoscale -n prod deploy crawler --cpu-percent=80 --min=1 --max=10
```

Edit on the fly with

```
kubectl -n prod edit hpa crawler
```

### Shutdown

    kubectl -n dev delete deploy/crawler deploy/redis \
       svc/crawler svc/redis

Delete secrets:

    kubectl -n dev delete Secrets secrets

### Debugging

Shell in same cluster:

    kubectl -n dev run alpine --image alpine:latest -i --tty --rm

Add curl:

    apk add curl

Queue work:
Make sure you started the container with the 5000 port forwarded for this to work.

    curl -d '{"type":"npm", "url":"cd:/npm/npmjs/-/redie/0.3.0"}' \
      -H "Content-Type: application/json" \
      -H "X-token: secret" \
      -X POST \
      http://crawler:5000/requests

  On windows:
    curl -d "{\"type\":\"npm\", \"url\":\"cd:/npm/npmjs/-/redie/0.3.0\"}" -H "Content-Type: application/json" -H "X-token: secret" -X POST http://localhost:5000/requests

Expose dashboard port:

    kubectl -n dev expose deployment dashboard --type="LoadBalancer" --name=external-dashboard --port=80 --target-port=4000
    kubectl -n dev get service external-dashboard

It will now be available on port 80 on the external IP returned by `kubectl get`.

Un-expose dashboard port:

    kubectl -n dev delete service external-dashboard

# Dashboard

The ghcrawler dashboard does **not** work properly with the current version of
ClearlyDefined crawler. It uses a very different configuration scheme that is
incompatible.

# ClearlyDefined, defined.

## Mission

Help FOSS projects be more successful through clearly defined project data.

For more details on the project, check out the [wiki](../../../clearlydefined/wiki).

# Contributing

This project welcomes contributions and suggestions, and we've documented the details of contribution policy [here](CONTRIBUTING.md).

The [Code of Conduct](CODE_OF_CONDUCT.md) for this project is details how the community interacts in
an inclusive and respectful manner. Please keep it in mind as you engage here.
