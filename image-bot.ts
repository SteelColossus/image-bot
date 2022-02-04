// The discord.js API
import type { TextBasedChannel } from 'discord.js';
import { Client, Intents } from 'discord.js';
// The google-images API
import GoogleImages from 'google-images';
// The winston API
import { createLogger, transports, format } from 'winston';

// Loads all tokens needed for APIs
import { config } from 'dotenv';
config();

const loggerFormat = format.combine(
    format.timestamp(),
    format.printf((info) => `${info.timestamp as string} ${info.level}: ${info.message}`)
);

// Sets up the logger
const logger = createLogger({
    format: loggerFormat,
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                loggerFormat
            )
        }),
        new transports.File({ filename: 'image-bot.log' })
    ]
});

if ((process.env.CSE_ID == null || !process.env.CSE_ID)
    || (process.env.API_KEY == null || !process.env.API_KEY)
    || (process.env.TOKEN == null || !process.env.TOKEN)) {
    logger.error('One or more of the required API keys were not found. Have you set the correct environment variables?');
    process.exit(1);
}

// The discord client used to interact with Discord
const client = new Client({
    intents: [
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES
    ],
    partials: [
        'CHANNEL',
        'MESSAGE'
    ]
});

// The google images client used to search for images
const imageClient = new GoogleImages(process.env.CSE_ID, process.env.API_KEY);

// The last time an image was requested
let lastRequestTime = new Date();

// The list of channels that the bot will automatically find images in
const autoChannels = new Map<string, boolean>();

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
];

// Returns a random number between a minimum and a maximum
function random(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getChannelName(channel: TextBasedChannel): string {
    if ('name' in channel) {
        return channel.name;
    }

    return `${channel.recipient.username} DM`;
}

function getSafeSetting(channel: TextBasedChannel): 'off' | 'high' {
    let nsfw = true;

    if ('nsfw' in channel) {
        // eslint-disable-next-line prefer-destructuring
        nsfw = channel.nsfw;
    }

    return nsfw ? 'off' : 'high';
}

// Posts a random image
function postRandomImage(query: string, channel: TextBasedChannel, gifsOnly = false): void {
    // Get the current request time
    const newTime = new Date().getTime() - lastRequestTime.getTime();

    // Check the messages are not being sent too quickly
    if (newTime <= 2500) {
        void channel.send('Don\'t spam so fast, I\'m on cooldown.');
        return;
    }

    if (query.includes('child')) {
        void channel.send('No thanks, I don\'t feel like getting on a watchlist.');
        return;
    }

    // Get a random page number. A page is a section of 10 images.
    const pageNumber = random(1, 5);

    // The safe search setting for this search
    const safeSetting = getSafeSetting(channel);

    lastRequestTime = new Date();

    // Query the image client for an image
    imageClient.search(query, { page: pageNumber, safe: safeSetting }).then((images) => {
        if (images.length > 0) {
            let image = { url: '' };

            let count = 0;
            const maxCount = 10;

            // Check if the image has a suitable file extension
            // eslint-disable-next-line no-unmodified-loop-condition
            while (!(((image.url.endsWith('.jpg') || image.url.endsWith('.png')) && !gifsOnly) || image.url.endsWith('.gif')) && count <= maxCount) {
                image = images[random(0, images.length - 1)];
                count += 1;
            }

            if (count <= maxCount) {
                // Send the image
                void channel.send({ files: [image.url] });
                logger.info(`Posted a new image: ${image.url}`);
            } else {
                void channel.send('No embeddable images were found matching your request.');
                logger.info(`No embeddable images were found matching the request: ${query}`);
            }
        } else {
            void channel.send('No images found matching your request.');
            logger.info(`No images were found matching the request: ${query}`);
        }
    }, (err: Error) => {
        void channel.send(`There was an error requesting your image: ${err.message}`);
        logger.error(`There was an error requesting the image '${query}': ${err.message}`);
    });
}

client.once('ready', () => {
    logger.info('I am ready!');
});

client.on('messageCreate', (message) => {
    // Check that a human sent the message and that there is some content
    if (!message.author.bot && message.content.length > 0) {
        if (message.content.startsWith(prefix)) {
            let firstSpaceIndex = message.content.indexOf(' ');

            if (firstSpaceIndex === -1) {
                firstSpaceIndex = message.content.length;
            }

            // Set up the command and arguments for it
            const command = message.content.substring(prefix.length, firstSpaceIndex);
            const remainingString = message.content.substring(firstSpaceIndex + 1).trim();

            // Enables automatic images
            if (command === 'enableautoimages') {
                const channelId = message.channel.id;
                const alreadyEnabled = autoChannels.get(channelId) ?? false;
                let messageText = '';

                if (!alreadyEnabled) {
                    autoChannels.set(channelId, true);
                    messageText = 'Automatic images have been enabled in this channel.';
                    logger.info(`Automatic images were enabled in channel: ${getChannelName(message.channel)}, id: ${channelId}`);
                } else {
                    messageText = 'Automatic images are already enabled in this channel.';
                }

                messageText += '\n If you want to disable automatic images in this channel, type `!disableautoimages`.';

                void message.channel.send(messageText);
            } else if (command === 'disableautoimages') {
                // Disables automatic images
                const channelId = message.channel.id;
                const alreadyDisabled = !(autoChannels.get(channelId) ?? false);
                let messageText = '';

                if (!alreadyDisabled) {
                    autoChannels.set(channelId, false);
                    messageText = 'Automatic images have been disabled in this channel.';
                    logger.info(`Automatic images were disabled in channel: ${getChannelName(message.channel)}, id: ${channelId}`);
                } else {
                    messageText = 'Automatic images are already disabled in this channel.';
                }

                messageText += '\n If you want to enable automatic images in this channel, type `!enableautoimages`.';

                void message.channel.send(messageText);
            } else if (command === 'image') {
                if (remainingString.length > 0) {
                    logger.info(`User '${message.author.username}' requested the image '${remainingString}' as a command`);

                    postRandomImage(remainingString, message.channel);
                } else {
                    void message.channel.send('You need to say which image to get!');
                }
            } else if (command === '8ball') {
                if (remainingString.length > 0) {
                    logger.info(`User '${message.author.username}' wanted to know the magic 8-ball's answer to the following question: '${remainingString}'`);

                    const randomResponse = ballResponses[random(0, ballResponses.length - 1)];

                    logger.info(`The magic 8-ball has an answer! It is: '${randomResponse}'`);

                    postRandomImage(`${randomResponse} gif`, message.channel, true);
                } else {
                    void message.channel.send('The magic 8-ball does not understand what you want - you need to give it a question!');
                }
            } else if (command === 'help' || command.includes('image')) {
                let messageText = '';

                if (command === 'help') {
                    messageText = 'Here are all my commands:';
                } else {
                    messageText = 'Did you mean to type one of the following?';
                }

                messageText += '\n';
                messageText += '`!image [query]` - fetches a random image from google images of [query]\n';
                messageText += '`!enableautoimages` - enables automatic images in the current channel\n';
                messageText += '`!disableautoimages` - disables automatic images in the current channel\n';
                messageText += '`!8ball [question]` - get the magic 8-ball\'s response to the [question]';

                void message.channel.send(messageText);
            }
        } else if (autoChannels.get(message.channel.id) ?? false) {
            logger.info(`User '${message.author.username}' requested the image '${message.content}' as an automatic image`);

            postRandomImage(message.content, message.channel);
        }
    }
});

client.on('error', (err: Error) => {
    logger.error(`There was a connection error: ${err.message}`);
});

void client.login(process.env.TOKEN);
