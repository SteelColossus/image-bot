# image-bot
A Discord bot which posts images from user searches.

## Running locally
1. Install [node/npm](https://nodejs.org).
2. Run `npm install` from the application's base folder.
3. Run `npm start`.

## Running from docker
You can run the latest version of the bot from docker by running the following command:
```
docker run -d --name image-bot -e TOKEN=<your-bot-token> -e CSE_ID=<your-cse-id> -e API_KEY=<your-google-api-key> steelcolossus/image-bot
```
