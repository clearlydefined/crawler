CALL docker kill cdcrawler
CALL mkdir C:\temp\crawler-data
CALL docker run --rm --name cdcrawler --env-file %~dp0\..\..\env.list -p 5000:5000 -p 9229:9229 -v C:\temp\crawler-data:/tmp/cd --entrypoint node cdcrawler:latest --inspect-brk=0.0.0.0:9229 index.js