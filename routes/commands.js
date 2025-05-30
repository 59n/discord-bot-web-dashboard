const express = require('express');
const router = express.Router();
const commandService = require('../services/commandService');
const { storage } = require('../config/database');

module.exports = (client, io) => {
    // Get all commands
    router.get('/commands', (req, res) => {
        try {
            const commands = commandService.getAllCommands();
            res.json(commands);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get command logs
    router.get('/command-logs', (req, res) => {
        res.json(storage.recentCommands);
    });

    // Get slash command status
    router.get('/slash-status', (req, res) => {
        res.json(commandService.getSlashStatus());
    });

    // Create new command
    router.post('/create-command', async (req, res) => {
        try {
            const command = await commandService.createCommand(req.body);
            
            if (command.type === 'slash') {
                setTimeout(async () => {
                    try {
                        const result = await commandService.registerSlashCommands(client);
                        if (result.success) {
                            io.emit('commandCreated', { ...command, registered: true });
                        } else {
                            io.emit('commandCreated', { ...command, registered: false });
                        }
                    } catch (error) {
                        console.error('Error registering new slash command:', error);
                        io.emit('commandCreated', { ...command, registered: false });
                    }
                }, 1000);
            } else {
                io.emit('commandCreated', command);
            }
            
            res.json({ success: true, command });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    });

    // Delete command
    router.delete('/delete-command/:name', async (req, res) => {
        try {
            const { name } = req.params;
            const result = await commandService.deleteCommand(name);
            
            if (result.wasSlashCommand) {
                setTimeout(() => commandService.registerSlashCommands(client).catch(console.error), 1000);
            }
            
            io.emit('commandDeleted', name);
            res.json({ success: true, message: 'Command deleted successfully' });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    });

    // Refresh slash commands
    router.post('/refresh-slash-commands', async (req, res) => {
        try {
            console.log('🔄 Manual slash command refresh requested...');
            const result = await commandService.forceRefreshSlashCommands(client);
            if (result.success) {
                io.emit('slashCommandsUpdated', result);
                res.json({ success: true, message: 'Slash commands refreshed successfully!' });
            } else {
                res.status(500).json({ success: false, message: 'Failed to refresh slash commands' });
            }
        } catch (error) {
            console.error('Error in manual refresh:', error);
            io.emit('slashCommandError', { error: error.message });
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
