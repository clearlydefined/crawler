CALL docker kill cdcrawler
CALL mkdir C:\temp\crawler-data
CALL docker run --init --rm --name cdcrawler --env-file %~dp0\..\..\env.list -p 5000:5000 -p 9229:9229 -v C:\temp\crawler-data:/tmp/cd cdcrawler:latest