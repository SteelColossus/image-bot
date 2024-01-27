import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { clientId, guildId } from './config.json';

// Loads all tokens needed for APIs
import { config } from 'dotenv';
config();

const commands = [
    new SlashCommandBuilder()
        .setName('image')
        .setDescription('Fetches a random image from Google Images of a query')
        .addStringOption((option) =>
            option.setName('query').setDescription('The query to search Google Images for').setRequired(true),
        ),
    new SlashCommandBuilder()
        .setName('enableautoimages')
        .setDescription('Enables automatic images in the current channel'),
    new SlashCommandBuilder()
        .setName('disableautoimages')
        .setDescription('Disables automatic images in the current channel'),
    new SlashCommandBuilder()
        .setName('8ball')
        .setDescription("Get the magic 8-ball's response to the question")
        .addStringOption((option) =>
            option.setName('question').setDescription('The question to ask the magic 8-ball').setRequired(true),
        ),
].map((command) => command.toJSON());

if (process.env.TOKEN == null || !process.env.TOKEN) {
    console.log('Token not found.');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

void (async (): Promise<void> => {
    try {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: commands,
        });
        console.log('Successfully registered application commands.');
    } catch (error) {
        console.error(error);
    }
})();
