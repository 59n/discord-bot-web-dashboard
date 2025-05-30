const { SlashCommandBuilder, REST, Routes } = require('discord.js');
const { storage } = require('../config/database');
const { BUILT_IN_COMMANDS } = require('../config/constants');
const { saveDataDebounced } = require('./dataService');

class CommandService {
    constructor() {
        this.registrationInProgress = false;
    }

    // Register slash commands with Discord
    async registerSlashCommands(client) {
        if (this.registrationInProgress) {
            console.log('⏳ Command registration already in progress...');
            return { success: false, error: 'Registration already in progress' };
        }

        try {
            this.registrationInProgress = true;
            console.log('🔄 Starting slash command registration...');
            
            // Debug: Check what commands we're getting
            console.log('🔍 Debug: BUILT_IN_COMMANDS keys:', Object.keys(BUILT_IN_COMMANDS));
            console.log('🔍 Debug: Total commands found:', Object.keys(BUILT_IN_COMMANDS).length);
            
            // Build commands array from ALL BUILT_IN_COMMANDS
            const builtInCommands = Object.entries(BUILT_IN_COMMANDS).map(([name, command]) => {
                console.log(`🔍 Processing built-in command: ${name}`);
                return {
                    name: name,
                    description: command.description,
                    options: command.options || []
                };
            });

            // Add custom slash commands
            const customSlashCommands = Array.from(storage.slashCommands.entries()).map(([name, command]) => {
                console.log(`🔍 Processing custom slash command: ${name}`);
                return {
                    name: name,
                    description: command.description,
                    options: command.options || []
                };
            });

            // Combine all commands
            const allCommands = [...builtInCommands, ...customSlashCommands];

            console.log(`📋 Adding ${customSlashCommands.length} custom slash commands...`);
            console.log(`🚀 Registering ${allCommands.length} slash commands...`);
            console.log('🔍 Commands being registered:', allCommands.map(cmd => cmd.name));

            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

            // Register all commands globally
            const result = await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: allCommands }
            );

            console.log(`✅ Successfully registered ${result.length} slash commands globally!`);
            
            return {
                success: true,
                commands: result,
                count: result.length
            };
        } catch (error) {
            console.error('❌ Error registering slash commands:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.registrationInProgress = false;
        }
    }

    // Force clear and re-register all commands
    async forceRefreshSlashCommands(client) {
        try {
            console.log('🔄 Force refreshing slash commands...');
            this.registrationInProgress = true;
            
            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
            
            // Clear all global commands first
            console.log('🗑️ Clearing all existing commands...');
            await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
            
            // Wait a moment for Discord to process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Re-register all commands
            const result = await this.registerSlashCommands(client);
            return result;
        } catch (error) {
            console.error('❌ Error in force refresh:', error);
            return { success: false, error: error.message };
        } finally {
            this.registrationInProgress = false;
        }
    }

    // Create a new command
    async createCommand(commandData) {
        const { 
            name, 
            description, 
            response, 
            embed, 
            embedTitle, 
            embedColor, 
            embedImage,
            commandType,
            options,
            conditions,
            cooldown,
            permissions
        } = commandData;
        
        if (!name || !response) {
            throw new Error('Name and response are required');
        }
        
        if (!/^[a-z0-9_-]{1,32}$/.test(name.toLowerCase())) {
            throw new Error('Command name must be 1-32 characters, lowercase letters, numbers, hyphens, and underscores only');
        }
        
        if (BUILT_IN_COMMANDS[name.toLowerCase()]) {
            throw new Error('Command name conflicts with built-in command');
        }
        
        const command = {
            name: name.toLowerCase(),
            description: description || 'Custom command',
            response,
            embed: !!embed,
            embedTitle: embedTitle || '',
            embedColor: embedColor || '#5865f2',
            embedImage: embedImage || '',
            type: commandType || 'custom',
            options: options || [],
            conditions: conditions || [],
            cooldown: cooldown || 0,
            permissions: permissions || [],
            createdAt: new Date().toISOString()
        };
        
        if (commandType === 'slash') {
            storage.slashCommands.set(name.toLowerCase(), command);
            console.log(`📝 Created new slash command: /${name}`);
        } else {
            storage.customCommands.set(name.toLowerCase(), command);
            console.log(`📝 Created new custom command: !${name}`);
        }
        
        saveDataDebounced();
        return command;
    }

    // Delete a command
    async deleteCommand(commandName) {
        if (BUILT_IN_COMMANDS[commandName]) {
            throw new Error('Cannot delete built-in commands');
        }
        
        let deleted = false;
        let wasSlashCommand = false;
        
        if (storage.customCommands.has(commandName)) {
            storage.customCommands.delete(commandName);
            if (storage.commandStats.customUsage) {
                delete storage.commandStats.customUsage[commandName];
            }
            deleted = true;
        }
        
        if (storage.slashCommands.has(commandName)) {
            storage.slashCommands.delete(commandName);
            if (storage.commandStats.slashUsage) {
                delete storage.commandStats.slashUsage[commandName];
            }
            wasSlashCommand = true;
            deleted = true;
            console.log(`🗑️ Deleted slash command: /${commandName}`);
        }
        
        if (!deleted) {
            throw new Error('Command not found');
        }
        
        saveDataDebounced();
        return { deleted: true, wasSlashCommand };
    }

    // Get all commands
    getAllCommands() {
        const builtinUsage = storage.commandStats.builtinUsage || {};
        const customUsage = storage.commandStats.customUsage || {};
        const slashUsage = storage.commandStats.slashUsage || {};
        
        return {
            builtin: Object.fromEntries(
                Object.entries(BUILT_IN_COMMANDS).map(([name, cmd]) => [
                    name, 
                    { ...cmd, usage: builtinUsage[name] || 0 }
                ])
            ),
            custom: Object.fromEntries(
                Array.from(storage.customCommands.entries()).map(([name, cmd]) => [
                    name,
                    { ...cmd, usage: customUsage[name] || 0 }
                ])
            ),
            slash: Object.fromEntries(
                Array.from(storage.slashCommands.entries()).map(([name, cmd]) => [
                    name,
                    { ...cmd, usage: slashUsage[name] || 0 }
                ])
            )
        };
    }

    // Get command statistics
    getCommandStats() {
        return {
            totalBuiltIn: Object.keys(BUILT_IN_COMMANDS).length,
            totalCustom: storage.customCommands.size,
            totalSlash: storage.slashCommands.size,
            totalCommands: Object.keys(BUILT_IN_COMMANDS).length + storage.customCommands.size + storage.slashCommands.size,
            totalUsage: storage.commandStats.totalCommandsUsed || 0
        };
    }

    // Get slash command status
    getSlashStatus() {
        return {
            registering: this.registrationInProgress,
            totalSlashCommands: storage.slashCommands.size + Object.keys(BUILT_IN_COMMANDS).length,
            builtInSlashCommands: Object.keys(BUILT_IN_COMMANDS).length,
            customSlashCommands: storage.slashCommands.size
        };
    }

    // Test command registration without actually registering
    async testCommandRegistration() {
        try {
            const builtInCommands = Object.entries(BUILT_IN_COMMANDS).map(([name, command]) => ({
                name: name,
                description: command.description,
                options: command.options || []
            }));

            const customSlashCommands = Array.from(storage.slashCommands.entries()).map(([name, command]) => ({
                name: name,
                description: command.description,
                options: command.options || []
            }));

            const allCommands = [...builtInCommands, ...customSlashCommands];

            return {
                success: true,
                totalCommands: allCommands.length,
                builtInCount: builtInCommands.length,
                customCount: customSlashCommands.length,
                commands: allCommands.map(cmd => ({
                    name: cmd.name,
                    description: cmd.description,
                    optionCount: cmd.options.length
                }))
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new CommandService();
