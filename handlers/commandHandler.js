const { EmbedBuilder } = require('discord.js');
const { storage } = require('../config/database');
const { BUILT_IN_COMMANDS } = require('../config/constants');
const { saveDataDebounced } = require('../services/dataService');

function setupCommandHandler(client, io) {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const prefix = '!';
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        storage.commandStats.totalCommandsUsed = (storage.commandStats.totalCommandsUsed || 0) + 1;

        const commandLog = {
            command: commandName,
            user: message.author.username,
            guild: message.guild?.name || 'DM',
            timestamp: new Date().toISOString(),
            type: 'prefix'
        };
        
        storage.recentCommands.unshift(commandLog);
        if (storage.recentCommands.length > 50) {
            storage.recentCommands = storage.recentCommands.slice(0, 50);
        }
        
        storage.botStats.commandsUsed = storage.commandStats.totalCommandsUsed;
        io.emit('commandUsed', commandLog);
        io.emit('statsUpdate', storage.botStats);

        if (BUILT_IN_COMMANDS[commandName]) {
            storage.commandStats.builtinUsage = storage.commandStats.builtinUsage || {};
            storage.commandStats.builtinUsage[commandName] = (storage.commandStats.builtinUsage[commandName] || 0) + 1;
            await handleBuiltInCommand(message, commandName, args);
        } else if (storage.customCommands.has(commandName)) {
            const command = storage.customCommands.get(commandName);
            storage.commandStats.customUsage = storage.commandStats.customUsage || {};
            storage.commandStats.customUsage[commandName] = (storage.commandStats.customUsage[commandName] || 0) + 1;
            await handleCustomCommand(message, command, args);
        }
        
        saveDataDebounced();
    });
}

async function handleBuiltInCommand(message, commandName, args) {
    try {
        switch (commandName) {
            case 'ping':
                const latency = Date.now() - message.createdTimestamp;
                await message.reply(`Pong! 🏓\nLatency: ${latency}ms\nAPI Latency: ${Math.round(message.client.ws.ping)}ms`);
                break;

            case 'echo':
                if (args.length === 0) {
                    await message.reply('❌ Please provide a message to echo!');
                    return;
                }
                await message.reply(args.join(' '));
                break;

            case 'roll':
                if (args.length === 0) {
                    const roll = Math.floor(Math.random() * 6) + 1;
                    await message.reply(`🎲 You rolled a ${roll}!`);
                } else {
                    const diceNotation = args[0];
                    const match = diceNotation.match(/^(\d+)d(\d+)$/);
                    if (match) {
                        const [, numDice, sides] = match;
                        const rolls = [];
                        let total = 0;
                        for (let i = 0; i < Math.min(numDice, 10); i++) {
                            const roll = Math.floor(Math.random() * sides) + 1;
                            rolls.push(roll);
                            total += roll;
                        }
                        await message.reply(`🎲 ${diceNotation}: [${rolls.join(', ')}] = **${total}**`);
                    } else {
                        await message.reply('❌ Invalid dice notation! Use format like `2d6` or `1d20`');
                    }
                }
                break;

            case 'serverinfo':
                if (!message.guild) {
                    await message.reply('This command can only be used in servers!');
                    return;
                }
                
                const embed = new EmbedBuilder()
                    .setTitle(`📊 ${message.guild.name} Server Info`)
                    .setThumbnail(message.guild.iconURL())
                    .addFields(
                        { name: '👑 Owner', value: `<@${message.guild.ownerId}>`, inline: true },
                        { name: '👥 Members', value: message.guild.memberCount.toString(), inline: true },
                        { name: '📅 Created', value: message.guild.createdAt.toDateString(), inline: true }
                    )
                    .setColor('#5865f2')
                    .setTimestamp();
                
                await message.reply({ embeds: [embed] });
                break;

            case 'userinfo':
                const user = message.mentions.users.first() || message.author;
                const member = message.guild?.members.cache.get(user.id);
                
                const userEmbed = new EmbedBuilder()
                    .setTitle(`👤 ${user.username} User Info`)
                    .setThumbnail(user.displayAvatarURL())
                    .addFields(
                        { name: '🏷️ Tag', value: user.tag, inline: true },
                        { name: '🆔 ID', value: user.id, inline: true },
                        { name: '📅 Account Created', value: user.createdAt.toDateString(), inline: true }
                    )
                    .setColor('#5865f2')
                    .setTimestamp();

                if (member) {
                    userEmbed.addFields(
                        { name: '📅 Joined Server', value: member.joinedAt.toDateString(), inline: true }
                    );
                }

                await message.reply({ embeds: [userEmbed] });
                break;

            case 'help':
                const builtinUsage = storage.commandStats.builtinUsage || {};
                const customUsage = storage.commandStats.customUsage || {};
                
                const helpEmbed = new EmbedBuilder()
                    .setTitle('🤖 Bot Commands')
                    .setDescription('Here are all available commands:')
                    .setColor('#5865f2');

                let builtInDesc = '';
                Object.values(BUILT_IN_COMMANDS).forEach(cmd => {
                    const usage = builtinUsage[cmd.name] || 0;
                    builtInDesc += `\`!${cmd.name}\` - ${cmd.description} (Used: ${usage})\n`;
                });
                helpEmbed.addFields({ name: '⚙️ Built-in Commands', value: builtInDesc || 'None', inline: false });

                if (storage.customCommands.size > 0) {
                    let customDesc = '';
                    storage.customCommands.forEach((cmd, name) => {
                        const usage = customUsage[name] || 0;
                        customDesc += `\`!${cmd.name}\` - ${cmd.description} (Used: ${usage})\n`;
                    });
                    helpEmbed.addFields({ name: '🎨 Custom Commands', value: customDesc, inline: false });
                }

                await message.reply({ embeds: [helpEmbed] });
                break;

            case 'clear':
                if (!message.member?.permissions.has('ManageMessages')) {
                    await message.reply('❌ You need "Manage Messages" permission!');
                    return;
                }

                const amount = parseInt(args[0]);
                if (isNaN(amount) || amount < 1 || amount > 100) {
                    await message.reply('❌ Please specify a number between 1 and 100!');
                    return;
                }

                const deleted = await message.channel.bulkDelete(amount + 1);
                const reply = await message.channel.send(`✅ Deleted ${deleted.size - 1} messages!`);
                setTimeout(() => reply.delete().catch(() => {}), 5000);
                break;

            // Moderation Commands
            case 'warn':
                if (!message.member?.permissions.has('ModerateMembers')) {
                    await message.reply('❌ You need "Moderate Members" permission!');
                    return;
                }
                
                const userToWarn = message.mentions.users.first();
                const warnReason = args.slice(1).join(' ');
                
                if (!userToWarn || !warnReason) {
                    await message.reply('❌ Usage: `!warn @user reason`');
                    return;
                }
                
                try {
                    const moderationService = require('../services/moderationService');
                    await moderationService.addWarning(message.guild.id, userToWarn.id, message.author.id, warnReason);
                    
                    const warnEmbed = new EmbedBuilder()
                        .setTitle('⚠️ User Warned')
                        .setDescription(`${userToWarn} has been warned by ${message.author}`)
                        .addFields({ name: 'Reason', value: warnReason })
                        .setColor('#ff9900')
                        .setTimestamp();
                    
                    await message.reply({ embeds: [warnEmbed] });
                    
                    // Try to DM the user
                    try {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('⚠️ Warning Received')
                            .setDescription(`You have received a warning in **${message.guild.name}**`)
                            .addFields({ name: 'Reason', value: warnReason })
                            .setColor('#ff9900')
                            .setTimestamp();
                        
                        await userToWarn.send({ embeds: [dmEmbed] });
                    } catch (error) {
                        console.log('Could not DM user about warning');
                    }
                } catch (error) {
                    await message.reply('❌ Failed to warn user');
                }
                break;

            case 'mute':
                if (!message.member?.permissions.has('ModerateMembers')) {
                    await message.reply('❌ You need "Moderate Members" permission!');
                    return;
                }
                
                const userToMute = message.mentions.users.first();
                const muteDuration = parseInt(args[1]) || 5; // Default 5 minutes
                const muteReason = args.slice(2).join(' ') || 'No reason provided';
                
                if (!userToMute) {
                    await message.reply('❌ Usage: `!mute @user [minutes] [reason]`');
                    return;
                }
                
                try {
                    const member = await message.guild.members.fetch(userToMute.id);
                    await member.timeout(muteDuration * 60000, muteReason);
                    
                    const moderationService = require('../services/moderationService');
                    await moderationService.addPunishment(
                        message.guild.id, 
                        userToMute.id, 
                        'mute', 
                        muteDuration * 60000, 
                        message.author.id, 
                        muteReason
                    );
                    
                    const muteEmbed = new EmbedBuilder()
                        .setTitle('🔇 User Muted')
                        .setDescription(`${userToMute} has been muted for ${muteDuration} minutes`)
                        .addFields({ name: 'Reason', value: muteReason })
                        .setColor('#ff0000')
                        .setTimestamp();
                    
                    await message.reply({ embeds: [muteEmbed] });
                } catch (error) {
                    await message.reply('❌ Failed to mute user');
                }
                break;

            case 'unmute':
                if (!message.member?.permissions.has('ModerateMembers')) {
                    await message.reply('❌ You need "Moderate Members" permission!');
                    return;
                }
                
                const userToUnmute = message.mentions.users.first();
                
                if (!userToUnmute) {
                    await message.reply('❌ Usage: `!unmute @user`');
                    return;
                }
                
                try {
                    const member = await message.guild.members.fetch(userToUnmute.id);
                    await member.timeout(null, 'Manual unmute');
                    
                    const unmuteEmbed = new EmbedBuilder()
                        .setTitle('🔊 User Unmuted')
                        .setDescription(`${userToUnmute} has been unmuted by ${message.author}`)
                        .setColor('#00ff00')
                        .setTimestamp();
                    
                    await message.reply({ embeds: [unmuteEmbed] });
                } catch (error) {
                    await message.reply('❌ Failed to unmute user');
                }
                break;

            case 'kick':
                if (!message.member?.permissions.has('KickMembers')) {
                    await message.reply('❌ You need "Kick Members" permission!');
                    return;
                }
                
                const userToKick = message.mentions.users.first();
                const kickReason = args.slice(1).join(' ') || 'No reason provided';
                
                if (!userToKick) {
                    await message.reply('❌ Usage: `!kick @user [reason]`');
                    return;
                }
                
                try {
                    const member = await message.guild.members.fetch(userToKick.id);
                    await member.kick(kickReason);
                    
                    const moderationService = require('../services/moderationService');
                    await moderationService.addPunishment(
                        message.guild.id, 
                        userToKick.id, 
                        'kick', 
                        null, 
                        message.author.id, 
                        kickReason
                    );
                    
                    const kickEmbed = new EmbedBuilder()
                        .setTitle('👢 User Kicked')
                        .setDescription(`${userToKick} has been kicked from the server`)
                        .addFields({ name: 'Reason', value: kickReason })
                        .setColor('#ff0000')
                        .setTimestamp();
                    
                    await message.reply({ embeds: [kickEmbed] });
                } catch (error) {
                    await message.reply('❌ Failed to kick user');
                }
                break;

            case 'ban':
                if (!message.member?.permissions.has('BanMembers')) {
                    await message.reply('❌ You need "Ban Members" permission!');
                    return;
                }
                
                const userToBan = message.mentions.users.first();
                const banReason = args.slice(1).join(' ') || 'No reason provided';
                
                if (!userToBan) {
                    await message.reply('❌ Usage: `!ban @user [reason]`');
                    return;
                }
                
                try {
                    const member = await message.guild.members.fetch(userToBan.id);
                    await member.ban({ reason: banReason, deleteMessageDays: 1 });
                    
                    const moderationService = require('../services/moderationService');
                    await moderationService.addPunishment(
                        message.guild.id, 
                        userToBan.id, 
                        'ban', 
                        null, 
                        message.author.id, 
                        banReason
                    );
                    
                    const banEmbed = new EmbedBuilder()
                        .setTitle('🔨 User Banned')
                        .setDescription(`${userToBan} has been banned from the server`)
                        .addFields({ name: 'Reason', value: banReason })
                        .setColor('#ff0000')
                        .setTimestamp();
                    
                    await message.reply({ embeds: [banEmbed] });
                } catch (error) {
                    await message.reply('❌ Failed to ban user');
                }
                break;

            case 'unban':
                if (!message.member?.permissions.has('BanMembers')) {
                    await message.reply('❌ You need "Ban Members" permission!');
                    return;
                }
                
                const userIdToUnban = args[0];
                const unbanReason = args.slice(1).join(' ') || 'No reason provided';
                
                if (!userIdToUnban) {
                    await message.reply('❌ Usage: `!unban <user_id> [reason]`');
                    return;
                }
                
                try {
                    await message.guild.members.unban(userIdToUnban, unbanReason);
                    
                    const unbanEmbed = new EmbedBuilder()
                        .setTitle('🔓 User Unbanned')
                        .setDescription(`User with ID ${userIdToUnban} has been unbanned`)
                        .addFields({ name: 'Reason', value: unbanReason })
                        .setColor('#00ff00')
                        .setTimestamp();
                    
                    await message.reply({ embeds: [unbanEmbed] });
                } catch (error) {
                    await message.reply('❌ Failed to unban user. Make sure the user ID is correct and the user is banned.');
                }
                break;

            case 'warnings':
                if (!message.member?.permissions.has('ModerateMembers')) {
                    await message.reply('❌ You need "Moderate Members" permission!');
                    return;
                }
                
                const userToCheck = message.mentions.users.first() || message.author;
                
                try {
                    const moderationService = require('../services/moderationService');
                    const warnings = moderationService.getUserWarnings(userToCheck.id, false);
                    const activeWarnings = warnings.filter(w => w.active);
                    
                    const warningsEmbed = new EmbedBuilder()
                        .setTitle(`⚠️ Warnings for ${userToCheck.username}`)
                        .setThumbnail(userToCheck.displayAvatarURL())
                        .setColor('#ff9900')
                        .setTimestamp();
                    
                    if (activeWarnings.length === 0) {
                        warningsEmbed.setDescription('No active warnings found.');
                    } else {
                        let warningsList = '';
                        activeWarnings.slice(0, 10).forEach((warning, index) => {
                            const date = new Date(warning.timestamp).toLocaleDateString();
                            warningsList += `**${index + 1}.** ${warning.reason}\n*${date} by <@${warning.moderatorId}>*\n\n`;
                        });
                        warningsEmbed.setDescription(warningsList);
                        
                        if (activeWarnings.length > 10) {
                            warningsEmbed.setFooter({ text: `Showing 10 of ${activeWarnings.length} warnings` });
                        }
                    }
                    
                    warningsEmbed.addFields(
                        { name: 'Active Warnings', value: activeWarnings.length.toString(), inline: true },
                        { name: 'Total Warnings', value: warnings.length.toString(), inline: true }
                    );
                    
                    await message.reply({ embeds: [warningsEmbed] });
                } catch (error) {
                    await message.reply('❌ Failed to retrieve warnings');
                }
                break;

            case 'modstats':
                if (!message.member?.permissions.has('ModerateMembers')) {
                    await message.reply('❌ You need "Moderate Members" permission!');
                    return;
                }
                
                try {
                    const moderationService = require('../services/moderationService');
                    const stats = moderationService.getModerationStats();
                    
                    const statsEmbed = new EmbedBuilder()
                        .setTitle('📊 Moderation Statistics')
                        .setColor('#5865f2')
                        .addFields(
                            { name: '⚠️ Total Warnings', value: stats.totalWarnings.toString(), inline: true },
                            { name: '🔴 Active Warnings', value: stats.activeWarnings.toString(), inline: true },
                            { name: '🚫 Total Punishments', value: stats.totalPunishments.toString(), inline: true },
                            { name: '🔴 Active Punishments', value: stats.activePunishments.toString(), inline: true },
                            { name: '📋 Total Actions', value: stats.totalActions.toString(), inline: true },
                            { name: '🤖 Auto-Mod Status', value: stats.autoModConfig.enabled ? '✅ Enabled' : '❌ Disabled', inline: true }
                        )
                        .setTimestamp();
                    
                    await message.reply({ embeds: [statsEmbed] });
                } catch (error) {
                    await message.reply('❌ Failed to retrieve moderation statistics');
                }
                break;

            case 'slowmode':
                if (!message.member?.permissions.has('ManageChannels')) {
                    await message.reply('❌ You need "Manage Channels" permission!');
                    return;
                }
                
                const slowmodeSeconds = parseInt(args[0]) || 0;
                
                if (slowmodeSeconds < 0 || slowmodeSeconds > 21600) {
                    await message.reply('❌ Slowmode must be between 0 and 21600 seconds (6 hours)!');
                    return;
                }
                
                try {
                    await message.channel.setRateLimitPerUser(slowmodeSeconds, `Slowmode set by ${message.author.username}`);
                    
                    const slowmodeEmbed = new EmbedBuilder()
                        .setTitle('⏱️ Slowmode Updated')
                        .setDescription(slowmodeSeconds === 0 ? 'Slowmode has been disabled' : `Slowmode set to ${slowmodeSeconds} seconds`)
                        .setColor(slowmodeSeconds === 0 ? '#00ff00' : '#ff9900')
                        .setTimestamp();
                    
                    await message.reply({ embeds: [slowmodeEmbed] });
                } catch (error) {
                    await message.reply('❌ Failed to set slowmode');
                }
                break;

            case 'lockdown':
                if (!message.member?.permissions.has('ManageChannels')) {
                    await message.reply('❌ You need "Manage Channels" permission!');
                    return;
                }
                
                try {
                    const everyone = message.guild.roles.everyone;
                    const currentPermissions = message.channel.permissionOverwrites.cache.get(everyone.id);
                    
                    if (currentPermissions && currentPermissions.deny.has('SendMessages')) {
                        // Unlock
                        await message.channel.permissionOverwrites.edit(everyone, {
                            SendMessages: null
                        });
                        
                        const unlockEmbed = new EmbedBuilder()
                            .setTitle('🔓 Channel Unlocked')
                            .setDescription('This channel has been unlocked. Users can now send messages.')
                            .setColor('#00ff00')
                            .setTimestamp();
                        
                        await message.reply({ embeds: [unlockEmbed] });
                    } else {
                        // Lock
                        await message.channel.permissionOverwrites.edit(everyone, {
                            SendMessages: false
                        });
                        
                        const lockEmbed = new EmbedBuilder()
                            .setTitle('🔒 Channel Locked')
                            .setDescription('This channel has been locked. Only moderators can send messages.')
                            .setColor('#ff0000')
                            .setTimestamp();
                        
                        await message.reply({ embeds: [lockEmbed] });
                    }
                } catch (error) {
                    await message.reply('❌ Failed to toggle channel lockdown');
                }
                break;
        }
    } catch (error) {
        console.error('Error executing built-in command:', error);
        await message.reply('❌ An error occurred while executing the command!');
    }
}

async function handleCustomCommand(message, command, args) {
    try {
        let response = command.response;
        
        response = response.replace(/{user}/g, message.author.username);
        response = response.replace(/{mention}/g, `<@${message.author.id}>`);
        response = response.replace(/{server}/g, message.guild?.name || 'DM');
        response = response.replace(/{args}/g, args.join(' '));
        
        if (command.conditions) {
            command.conditions.forEach(condition => {
                if (condition.type === 'role' && message.member) {
                    const hasRole = message.member.roles.cache.some(role => role.name.toLowerCase() === condition.value.toLowerCase());
                    if (!hasRole && condition.required) {
                        message.reply(`❌ You need the "${condition.value}" role to use this command!`);
                        return;
                    }
                }
            });
        }
        
        if (command.embed) {
            const embed = new EmbedBuilder()
                .setTitle(command.embedTitle || command.name)
                .setDescription(response)
                .setColor(command.embedColor || '#5865f2');
            
            if (command.embedImage) {
                embed.setImage(command.embedImage);
            }
            
            await message.reply({ embeds: [embed] });
        } else {
            await message.reply(response);
        }
    } catch (error) {
        console.error('Error executing custom command:', error);
        await message.reply('❌ An error occurred while executing the command!');
    }
}

module.exports = { setupCommandHandler };
