# Add a new harvest source

This is a document in progress detailing the steps necessary to add a new harvest source.
When adding a new harvest source, the points to be considered are located at https://github.com/clearlydefined/clearlydefined/blob/master/docs/adding-sources.md#adding-a-new-harvest-source. Please include these considerations and document them in your GitHub issue, similar to https://github.com/clearlydefined/service/issues/882.

## Crawler
Implementation in fetch and processor (xxExtract)

Example commit:
```
Commit: ea1618de0de4663b4d9aeecc9cdbc392edb2feba [ea1618d]
Parents: 968422b174
Author: Nell Shamrell nells@microsoft.com
Date: October 27, 2021 4:16:41 PM
Committer: Nell Shamrell
adds support for fetching and extracting go packages to the crawler
```

## Service

1. ClearlyDescribedSummarizer
Example commit:
```
Commit: 5e8b305f108b8cc9bd18c35ad5c626f71c081ef2 [5e8b305]
Parents: 6906969865
Author: Nell Shamrell nells@microsoft.com
Date: August 3, 2021 2:55:44 PM
Committer: Nell Shamrell
Commit Date: October 27, 2021 3:56:37 PM
adds in code and test for determining urls for a go package
```
2. origin service (for ui query)
Example commit:
```
Commit: 8c057670781451cfd7ca22337cecacae2124ac85 [8c05767]
Parents: 542c02763d
Author: Nell Shamrell nells@microsoft.com
Date: October 28, 2021 4:17:40 PM
Committer: Nell Shamrell
adds ability to get go package revisions through the service API
```
3. update validation schemas.
Example commit:
```
Commit: 21e11c45b97c06170f436db498c534ff079443d3 [21e11c4]
Parents: 90c8414909
Author: Nell Shamrell nells@microsoft.com
Date: July 29, 2021 3:17:35 PM
Committer: Nell Shamrell
Commit Date: October 27, 2021 3:55:33 PM
adds go as a type in schemas
```
## Documentation
Adaptation to reflect the new harvest source in the following documents:
- service/README.md
- service/swagger.yaml
- service/docs/determining-declared-license.md
- clearlydefined/docs/adding-sources.md