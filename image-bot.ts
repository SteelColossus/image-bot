// The discord.js API
import type { CommandInteraction, Message, MessageOptions, TextBasedChannel } from 'discord.js';
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

// eslint-disable-next-line max-params,max-len
async function postRandomImage<T>(query: string, sendMessage: (message: string | MessageOptions) => Promise<T>, channel: TextBasedChannel | null, gifsOnly = false): Promise<T> {
    // Get the current request time
    const newTime = new Date().getTime() - lastRequestTime.getTime();

    // Check the messages are not being sent too quickly
    if (newTime <= 2500) {
        return sendMessage('Don\'t spam so fast, I\'m on cooldown.');
    }

    if (query.includes('child')) {
        return sendMessage('No thanks, I don\'t feel like getting on a watchlist.');
    }

    // Get a random page number. A page is a section of 10 images.
    const pageNumber = random(1, 5);

    // The safe search setting for this search
    const safeSetting = channel != null ? getSafeSetting(channel) : 'off';

    lastRequestTime = new Date();

    // Query the image client for an image
    try {
        const images = await imageClient.search(query, { page: pageNumber, safe: safeSetting });

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
                logger.info(`Posted a new image: ${image.url}`);
                // Send the image
                return await sendMessage({ files: [image.url] });
            }

            logger.info(`No embeddable images were found matching the request: ${query}`);
            return await sendMessage('No embeddable images were found matching your request.');
        }

        logger.info(`No images were found matching the request: ${query}`);
        return await sendMessage('No images found matching your request.');
    } catch (rejectedResponse) {
        const err = rejectedResponse as Error;
        logger.error(`There was an error requesting the image '${query}': ${err.message}`);
        return await sendMessage(`There was an error requesting your image: ${err.message}`);
    }
}

async function postRandomImageWithChannel(query: string, channel: TextBasedChannel): Promise<Message> {
    return postRandomImage(query, async(message) => channel.send(message), channel);
}

async function postRandomImageWithInteraction(query: string, interaction: CommandInteraction, gifsOnly: boolean): Promise<void> {
    await postRandomImage(query, async(message) => interaction.reply(message), interaction.channel, gifsOnly);
}

client.once('ready', () => {
    logger.info('I am ready!');
});

client.on('messageCreate', async(message) => {
    // Check that a human sent the message and that there is some content
    if (!message.author.bot && message.content.length > 0) {
        if (autoChannels.get(message.channel.id) ?? false) {
            logger.info(`User '${message.author.username}' requested the image '${message.content}' as an automatic image`);

            await postRandomImageWithChannel(message.content, message.channel);
        }
    }
});

client.on('interactionCreate', async(interaction) => {
    if (!interaction.isCommand()) {
        return;
    }

    logger.info(interaction.inCachedGuild());

    switch (interaction.commandName) {
        case 'enableautoimages': {
            if (interaction.channel == null) {
                await interaction.reply('This command must be run within a channel.');
                return;
            }

            const { channelId } = interaction;
            const alreadyEnabled = autoChannels.get(channelId) ?? false;
            let messageText = '';

            if (!alreadyEnabled) {
                autoChannels.set(channelId, true);
                messageText = 'Automatic images have been enabled in this channel.';
                logger.info(`Automatic images were enabled in channel: ${getChannelName(interaction.channel)}, id: ${channelId}`);
            } else {
                messageText = 'Automatic images are already enabled in this channel.';
            }

            messageText += '\n If you want to disable automatic images in this channel, use `/disableautoimages`.';

            await interaction.reply(messageText);
            break;
        }
        case 'disableautoimages': {
            if (interaction.channel == null) {
                await interaction.reply('This command must be run within a channel.');
                return;
            }

            const { channelId } = interaction;
            const alreadyDisabled = !(autoChannels.get(channelId) ?? false);
            let messageText = '';

            if (!alreadyDisabled) {
                autoChannels.set(channelId, false);
                messageText = 'Automatic images have been disabled in this channel.';
                logger.info(`Automatic images were disabled in channel: ${getChannelName(interaction.channel)}, id: ${channelId}`);
            } else {
                messageText = 'Automatic images are already disabled in this channel.';
            }

            messageText += '\n If you want to enable automatic images in this channel, use `/enableautoimages`.';

            await interaction.reply(messageText);
            break;
        }
        case 'image': {
            const query = interaction.options.getString('query');

            if (query != null) {
                logger.info(`User '${interaction.user.username}' requested the image '${query}' as a command`);

                await postRandomImageWithInteraction(query, interaction, false);
            } else {
                await interaction.reply('You need to say which image to get!');
            }

            break;
        }
        case '8ball': {
            const question = interaction.options.getString('question');

            if (question != null) {
                logger.info(`User '${interaction.user.username}' wanted to know the magic 8-ball's answer to the following question: '${question}'`);

                const randomResponse = ballResponses[random(0, ballResponses.length - 1)];

                logger.info(`The magic 8-ball has an answer! It is: '${randomResponse}'`);

                await postRandomImageWithInteraction(`${randomResponse} gif`, interaction, true);
            } else {
                await interaction.reply('The magic 8-ball does not understand what you want - you need to give it a question!');
            }

            break;
        }
        default:
            logger.info(`Command is not supported: ${interaction.commandName}`);
            await interaction.reply(`Command is not supported: ${interaction.commandName}`);
            break;
    }
});

client.on('error', (err: Error) => {
    logger.error(`There was a connection error: ${err.message}`);
});

void client.login(process.env.TOKEN);
