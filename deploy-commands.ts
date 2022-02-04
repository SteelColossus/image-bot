/* eslint-disable no-console */
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { clientId, guildId } from './config.json';

// Loads all tokens needed for APIs
import { config } from 'dotenv';
config();

const commands = [
    new SlashCommandBuilder().setName('image')
        .setDescription('Fetches a random image from Google Images of a query')
        .addStringOption((option) => option.setName('query')
            .setDescription('The query to search Google Images for')
            .setRequired(true)),
    new SlashCommandBuilder().setName('enableautoimages')
        .setDescription('Enables automatic images in the current channel'),
    new SlashCommandBuilder().setName('disableautoimages')
        .setDescription('Disables automatic images in the current channel'),
    new SlashCommandBuilder().setName('8ball')
        .setDescription('Get the magic 8-ball\'s response to the question')
        .addStringOption((option) => option.setName('question')
            .setDescription('The question to ask the magic 8-ball')
            .setRequired(true))
]
    .map((command) => command.toJSON());

if (process.env.TOKEN == null || !process.env.TOKEN) {
    console.log('Token not found.');
    process.exit(1);
}

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
    .then(() => {
        console.log('Successfully registered application commands.');
    })
    .catch(console.error);
