// The discord.js API
const Discord = require('discord.js');

// The google-images API
const GoogleImages = require('google-images');

// The winston API
const Winston = require('winston');

// Sets up the logger
const logger = Winston.createLogger({
    transports: [
        new Winston.transports.Console({ colorize: true, timestamp: true }),
        new Winston.transports.File({ filename: 'image-bot.log' })
    ]
})

// Loads all tokens needed for APIs
require('dotenv').config();

if (!process.env.CSE_ID || !process.env.API_KEY || !process.env.TOKEN) {
    logger.error('One or more of the required api keys were not found. Have you set the correct environment variables?');
    return;
}

// The discord client used to interact with Discord
const client = new Discord.Client();

// The google images client used to search for images
const imageClient = new GoogleImages(process.env.CSE_ID, process.env.API_KEY);

// The last time an image was requested
let lastRequestTime = new Date();

// The list of channels that the bot will automatically find images in 
const autoChannels = {};

// The prefix for all commands
const prefix = '!';

// The list of all responses you can get from the magic 8-ball
const ballResponses = [
    'yes',
    'no',
    'maybe',
    'definitely',
    'absolutely not',
    'stupid question',
    'nodding',
    'shaking my head'
]

// Returns a random number between a minimum and a maximum
function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Posts a random image
function postRandomImage(query, channel, gifsOnly = false) {
    // Get the current request time
    const newTime = new Date().getTime() - lastRequestTime.getTime();

    // Check the messages are not being sent too quickly
    if (newTime <= 2500) {
        channel.send('Don\'t spam so fast, I\'m on cooldown.');
        return;
    }

    if (query.includes('child')) {
        channel.send('No thanks, I don\'t feel like getting on a watchlist.');
        return;
    }

    // Get a random page number. A page is a section of 10 images.
    const pageNumber = random(1, 5);

    // The safe search setting for this search
    const safeSetting = (channel.nsfw) ? 'off' : 'high';

    lastRequestTime = new Date();

    // Query the image client for an image
    imageClient.search(query, { page: pageNumber, safe: safeSetting }).then((images) => {
        if (images.length > 0) {
            let image = { url: '' };

            let count = 0;
            const maxCount = 10;

            // Check if the image has a suitable file extension
            while (!(((image.url.endsWith('.jpg') || image.url.endsWith('.png')) && !gifsOnly) || image.url.endsWith('.gif')) && count <= maxCount) {
                image = images[random(0, images.length - 1)];
                count++;
            }

            if (count <= maxCount) {
                // Send the image
                channel.send('', { file: image.url });
                logger.info(`Posted a new image: ${image.url}`);
            }
            else {
                channel.send('No embeddable images were found matching your request.');
                logger.info(`No embeddable images were found matching the request: ${query}`);
            }
        }
        else {
            channel.send('No images found matching your request.');
            logger.info(`No images were found matching the request: ${query}`);
        }
    }, (err) => {
        channel.send(`There was an error requesting your image: ${err.message}`);
        logger.error(`There was an error requesting the image '${query}': ${err.message}`);
    });
}

client.on('ready', () => {
    logger.info('I am ready!');
});

client.on('message', (message) => {
    // Check that a human sent the message and that there is some content
    if (!message.author.bot && message.content.length > 0) {
        if (message.content.startsWith(prefix)) {
            let firstSpaceIndex = message.content.indexOf(' ');

            if (firstSpaceIndex === -1) {
                firstSpaceIndex = message.content.length;
            }

            // Set up the command and arguments for it
            const command = message.content.substring(prefix.length, firstSpaceIndex);
            const remainingString = message.content.substring(firstSpaceIndex + 1);

            // Enables automatic images
            if (command === 'enableautoimages') {
                const channelId = message.channel.id;
                const alreadyEnabled = (autoChannels[channelId] === true);
                let messageText = '';

                if (!alreadyEnabled) {
                    autoChannels[channelId] = true;
                    messageText = 'Automatic images have been enabled in this channel.';
                    logger.info(`Automatic images were enabled in channel: ${message.channel.name}, id: ${channelId}`);
                }
                else {
                    messageText = 'Automatic images are already enabled in this channel.';
                }

                messageText += '\n If you want to disable automatic images in this channel, type `!disableautoimages`.';

                message.channel.send(messageText);
            }
            // Disables automatic images
            else if (command === 'disableautoimages') {
                const channelId = message.channel.id;
                const alreadyDisabled = (autoChannels[channelId] !== true);
                let messageText = '';

                if (!alreadyDisabled) {
                    autoChannels[channelId] = false;
                    messageText = 'Automatic images have been disabled in this channel.';
                    logger.info(`Automatic images were disabled in channel: ${message.channel.name}, id: ${channelId}`);
                }
                else {
                    messageText = 'Automatic images are already disabled in this channel.';
                }

                messageText += '\n If you want to enable automatic images in this channel, type `!enableautoimages`.';

                message.channel.send(messageText);
            }
            else if (command === 'image') {
                logger.info(`User '${message.author.username}' requested the image '${remainingString}' as a command`);

                postRandomImage(remainingString, message.channel);
            }
            else if (command === '8ball') {
                logger.info(`User '${message.author.username}' wanted to know the magic 8-ball's answer to the following question: '${remainingString}'`);

                const randomResponse = ballResponses[random(0, ballResponses.length - 1)];

                logger.info(`The magic 8-ball has an answer! It is: '${randomResponse}'`);

                postRandomImage(randomResponse + ' gif', message.channel, true);
            }
            else if (command === 'help' || command.includes('image')) {
                let messageText = '';

                if (command === 'help') {
                    messageText = 'Here are all my commands:';
                }
                else {
                    messageText = 'Did you mean to type one of the following?';
                }

                messageText += '\n\n';
                messageText += '`!image [query]` - fetches a random image from google images of [query]\n';
                messageText += '`!enableautoimages` - enables automatic images in the current channel\n';
                messageText += '`!disableautoimages` - disables automatic images in the current channel\n';
                messageText += '`!8ball [question]` - get the magic 8-ball\'s response to the [question]';

                message.channel.send(messageText);
            }
        }
        else if (autoChannels[message.channel.id] === true) {
            logger.info(`User '${message.author.username}' requested the image '${message.content}' as an automatic image`);

            postRandomImage(message.content, message.channel);
        }
    }
});

client.on('error', (err) => {
    logger.error(`There was a connection error: ${err.message}`);
});

client.login(process.env.TOKEN);
