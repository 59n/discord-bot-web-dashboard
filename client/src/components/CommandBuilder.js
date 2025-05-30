import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Grid,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  CircularProgress
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon, 
  Code as CodeIcon,
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

// Permission utility functions
const hasPermission = (userRole, permission) => {
  const PERMISSIONS = {
    CREATE_COMMANDS: ['admin', 'moderator'],
    DELETE_COMMANDS: ['admin'],
    VIEW_COMMANDS: ['admin', 'moderator', 'viewer'],
    REFRESH_SLASH: ['admin', 'moderator'],
    VIEW_LOGS: ['admin', 'moderator', 'viewer']
  };
  return PERMISSIONS[permission]?.includes(userRole) || false;
};

const CommandBuilder = ({ socket, user }) => {
  const [tabValue, setTabValue] = useState(0);
  const [commands, setCommands] = useState({ builtin: {}, custom: {}, slash: {} });
  const [commandLogs, setCommandLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [slashStatus, setSlashStatus] = useState({ 
    registering: false, 
    totalSlashCommands: 0,
    builtInSlashCommands: 0 
  });
  
  const [newCommand, setNewCommand] = useState({
    name: '',
    description: '',
    response: '',
    embed: false,
    embedTitle: '',
    embedColor: '#5865f2',
    embedImage: '',
    commandType: 'custom',
    options: [],
    conditions: [],
    cooldown: 0,
    permissions: []
  });
  
  const [deleteDialog, setDeleteDialog] = useState({ 
    open: false, 
    command: null,
    type: null 
  });

  // Permission checks
  const canCreateCommands = hasPermission(user?.role, 'CREATE_COMMANDS');
  const canDeleteCommands = hasPermission(user?.role, 'DELETE_COMMANDS');
  const canViewCommands = hasPermission(user?.role, 'VIEW_COMMANDS');
  const canRefreshSlash = hasPermission(user?.role, 'REFRESH_SLASH');
  const canViewLogs = hasPermission(user?.role, 'VIEW_LOGS');

  const apiRequest = async (url, options = {}) => {
    const baseURL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3000/api';
    const response = await fetch(baseURL + url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }
    
    return response.json();
  };

  useEffect(() => {
    if (canViewCommands) {
      loadCommands();
    }
    if (canViewLogs) {
      loadCommandLogs();
    }
    checkSlashStatus();
  }, [canViewCommands, canViewLogs]);

  useEffect(() => {
    if (socket) {
      socket.on('commandUsed', (commandLog) => {
        if (canViewLogs) {
          setCommandLogs(prev => [commandLog, ...prev.slice(0, 49)]);
        }
      });

      socket.on('commandCreated', (command) => {
        if (command.type === 'slash') {
          setCommands(prev => ({
            ...prev,
            slash: { ...prev.slash, [command.name]: command }
          }));
          toast.success(
            `Slash command "/${command.name}" created! ${
              command.registered 
                ? 'It should appear in Discord within 1 hour.' 
                : 'Registration may have failed - try refreshing.'
            }`
          );
        } else {
          setCommands(prev => ({
            ...prev,
            custom: { ...prev.custom, [command.name]: command }
          }));
          toast.success(`Custom command "!${command.name}" created!`);
        }
      });

      socket.on('commandDeleted', (commandName) => {
        setCommands(prev => {
          const newCustom = { ...prev.custom };
          const newSlash = { ...prev.slash };
          delete newCustom[commandName];
          delete newSlash[commandName];
          return { ...prev, custom: newCustom, slash: newSlash };
        });
        toast.success(`Command "${commandName}" deleted!`);
      });

      socket.on('slashCommandsUpdated', (data) => {
        toast.success(`${data.count} slash commands registered successfully!`);
        setSlashStatus(prev => ({ 
          ...prev, 
          registering: false,
          totalSlashCommands: data.count 
        }));
      });

      socket.on('slashCommandError', (data) => {
        toast.error(`Slash command registration failed: ${data.error}`);
        setSlashStatus(prev => ({ ...prev, registering: false }));
      });

      return () => {
        socket.off('commandUsed');
        socket.off('commandCreated');
        socket.off('commandDeleted');
        socket.off('slashCommandsUpdated');
        socket.off('slashCommandError');
      };
    }
  }, [socket, canViewLogs]);

  const loadCommands = async () => {
    try {
      const response = await apiRequest('/commands');
      setCommands(response);
    } catch (error) {
      toast.error('Failed to load commands');
      console.error('Load commands error:', error);
    }
  };

  const loadCommandLogs = async () => {
    try {
      const response = await apiRequest('/command-logs');
      setCommandLogs(response);
    } catch (error) {
      console.error('Failed to load command logs:', error);
    }
  };

  const checkSlashStatus = async () => {
    try {
      const response = await apiRequest('/slash-status');
      setSlashStatus(response);
    } catch (error) {
      console.error('Error checking slash status:', error);
    }
  };

  const refreshSlashCommands = async () => {
    if (!canRefreshSlash) {
      toast.error('You do not have permission to refresh slash commands');
      return;
    }

    setRefreshing(true);
    try {
      const response = await apiRequest('/refresh-slash-commands', {
        method: 'POST'
      });
      if (response.success) {
        toast.success('Slash commands refreshed! They should appear in Discord within 1 hour (or restart Discord app)');
        setSlashStatus(prev => ({ ...prev, registering: true }));
        setTimeout(() => checkSlashStatus(), 5000);
      } else {
        toast.error('Failed to refresh slash commands');
      }
    } catch (error) {
      toast.error('Error refreshing slash commands: ' + error.message);
    }
    setRefreshing(false);
  };

  const createCommand = async () => {
    if (!canCreateCommands) {
      toast.error('You do not have permission to create commands');
      return;
    }

    if (!newCommand.name || !newCommand.response) {
      toast.error('Name and response are required');
      return;
    }

    if (!validateCommandName(newCommand.name)) {
      toast.error('Command name must be 1-32 characters, lowercase letters, numbers, hyphens, and underscores only');
      return;
    }

    try {
      await apiRequest('/create-command', {
        method: 'POST',
        body: JSON.stringify(newCommand)
      });
      
      setNewCommand({
        name: '',
        description: '',
        response: '',
        embed: false,
        embedTitle: '',
        embedColor: '#5865f2',
        embedImage: '',
        commandType: 'custom',
        options: [],
        conditions: [],
        cooldown: 0,
        permissions: []
      });

      if (newCommand.commandType === 'slash') {
        setSlashStatus(prev => ({ ...prev, registering: true }));
      }
    } catch (error) {
      toast.error(error.message || 'Failed to create command');
    }
  };

  const deleteCommand = async (commandName, type) => {
    if (!canDeleteCommands) {
      toast.error('You do not have permission to delete commands');
      return;
    }

    try {
      await apiRequest(`/delete-command/${commandName}`, {
        method: 'DELETE'
      });
      setDeleteDialog({ open: false, command: null, type: null });
      
      if (type === 'slash') {
        setSlashStatus(prev => ({ ...prev, registering: true }));
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete command');
    }
  };

  const validateCommandName = (name) => {
    const regex = /^[a-z0-9_-]{1,32}$/;
    return regex.test(name);
  };

  const addOption = () => {
    setNewCommand(prev => ({
      ...prev,
      options: [...prev.options, { 
        name: '', 
        description: '', 
        type: 'string', 
        required: false 
      }]
    }));
  };

  const removeOption = (index) => {
    setNewCommand(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const updateOption = (index, field, value) => {
    setNewCommand(prev => ({
      ...prev,
      options: prev.options.map((option, i) => 
        i === index ? { ...option, [field]: value } : option
      )
    }));
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusIcon = () => {
    if (slashStatus.registering || refreshing) {
      return <CircularProgress size={16} />;
    }
    return slashStatus.totalSlashCommands > 0 ? 
      <CheckCircleIcon color="success" /> : 
      <WarningIcon color="warning" />;
  };

  const getTotalUsage = (commandsObj) => {
    return Object.values(commandsObj).reduce((total, cmd) => total + (cmd.usage || 0), 0);
  };

  // Permission denied component
  if (!canViewCommands) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={8}>
            <LockIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Access Denied
            </Typography>
            <Typography variant="body2" color="textSecondary" textAlign="center">
              You do not have permission to view commands. Contact an administrator for access.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            <CodeIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Advanced Command System
          </Typography>
          
          <Box display="flex" alignItems="center" gap={1}>
            {getStatusIcon()}
            <Chip 
              label={
                slashStatus.registering 
                  ? 'Registering...' 
                  : `${slashStatus.totalSlashCommands} slash commands`
              }
              color={
                slashStatus.registering 
                  ? 'warning' 
                  : slashStatus.totalSlashCommands > 0 
                    ? 'success' 
                    : 'default'
              }
              size="small"
            />
            <Chip 
              label={user?.role || 'Unknown'}
              color={user?.role === 'admin' ? 'error' : user?.role === 'moderator' ? 'warning' : 'default'}
              size="small"
            />
          </Box>
        </Box>
        
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          {canCreateCommands && <Tab label="Create Command" />}
          <Tab 
            label={`Manage Commands (${
              Object.keys(commands.builtin).length + 
              Object.keys(commands.custom).length + 
              Object.keys(commands.slash).length
            })`} 
          />
          {canViewLogs && <Tab label={`Command Logs (${commandLogs.length})`} />}
        </Tabs>

        <Box sx={{ mt: 3 }}>
          {/* Create Command Tab */}
          {tabValue === 0 && canCreateCommands && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Alert severity="info" sx={{ mb: 3 }}>
                <strong>Your Role: {user?.role}</strong> - You can create and manage commands.
              </Alert>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Command Name"
                    value={newCommand.name}
                    onChange={(e) => setNewCommand({ 
                      ...newCommand, 
                      name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') 
                    })}
                    placeholder="mycommand"
                    helperText="Lowercase letters, numbers, hyphens, underscores only"
                    error={Boolean(newCommand.name && !validateCommandName(newCommand.name))}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Command Type</InputLabel>
                    <Select
                      value={newCommand.commandType}
                      onChange={(e) => setNewCommand({ ...newCommand, commandType: e.target.value })}
                    >
                      <MenuItem value="custom">
                        <Box display="flex" alignItems="center">
                          <Typography>Prefix Command (!)</Typography>
                          <Chip label="Instant" size="small" color="success" sx={{ ml: 1 }} />
                        </Box>
                      </MenuItem>
                      <MenuItem value="slash">
                        <Box display="flex" alignItems="center">
                          <Typography>Slash Command (/)</Typography>
                          <Chip label="Up to 1hr delay" size="small" color="warning" sx={{ ml: 1 }} />
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    value={newCommand.description}
                    onChange={(e) => setNewCommand({ ...newCommand, description: e.target.value })}
                    placeholder="What this command does"
                    inputProps={{ maxLength: 100 }}
                    helperText={`${newCommand.description.length}/100 characters`}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Response"
                    value={newCommand.response}
                    onChange={(e) => setNewCommand({ ...newCommand, response: e.target.value })}
                    placeholder="Hello {user}! Welcome to {server}!"
                    inputProps={{ maxLength: 2000 }}
                    helperText={`${newCommand.response.length}/2000 characters`}
                  />
                  <Alert severity="info" sx={{ mt: 1 }}>
                    <strong>Available placeholders:</strong> 
                    <br />• <code>{'{user}'}</code> - Username
                    <br />• <code>{'{mention}'}</code> - @User mention  
                    <br />• <code>{'{server}'}</code> - Server name
                    <br />• <code>{'{args}'}</code> - Command arguments (prefix commands only)
                  </Alert>
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={newCommand.embed}
                        onChange={(e) => setNewCommand({ ...newCommand, embed: e.target.checked })}
                      />
                    }
                    label="Use Rich Embed (Colored message box)"
                  />
                </Grid>

                {newCommand.embed && (
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ width: '100%' }}
                    >
                      <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Embed Title"
                            value={newCommand.embedTitle}
                            onChange={(e) => setNewCommand({ ...newCommand, embedTitle: e.target.value })}
                            placeholder="Optional title"
                            inputProps={{ maxLength: 256 }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="color"
                            label="Embed Color"
                            value={newCommand.embedColor}
                            onChange={(e) => setNewCommand({ ...newCommand, embedColor: e.target.value })}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Embed Image URL"
                            value={newCommand.embedImage}
                            onChange={(e) => setNewCommand({ ...newCommand, embedImage: e.target.value })}
                            placeholder="https://example.com/image.png (optional)"
                          />
                        </Grid>
                      </Grid>
                    </motion.div>
                  </AnimatePresence>
                )}

                {newCommand.commandType === 'slash' && (
                  <Grid item xs={12}>
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>
                          Slash Command Options ({newCommand.options.length}/25)
                        </Typography>
                        <Chip 
                          label="Advanced" 
                          size="small" 
                          color="primary" 
                          sx={{ ml: 2 }} 
                        />
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box>
                          {newCommand.options.length === 0 && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                              Options allow users to provide input to your slash command. 
                              For example, a "ban" command might have a "user" option and a "reason" option.
                            </Alert>
                          )}
                          
                          {newCommand.options.map((option, index) => (
                            <Box 
                              key={index} 
                              sx={{ 
                                mb: 2, 
                                p: 2, 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                borderRadius: 2,
                                backgroundColor: 'rgba(255,255,255,0.02)'
                              }}
                            >
                              <Typography variant="subtitle2" gutterBottom>
                                Option {index + 1}
                              </Typography>
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    fullWidth
                                    label="Option Name"
                                    value={option.name}
                                    onChange={(e) => updateOption(index, 'name', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                                    placeholder="username"
                                    size="small"
                                    error={Boolean(option.name && !validateCommandName(option.name))}
                                    helperText={option.name && !validateCommandName(option.name) ? "Invalid name" : "Used in placeholders: {" + option.name + "}"}
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <FormControl fullWidth size="small">
                                    <InputLabel>Type</InputLabel>
                                    <Select
                                      value={option.type}
                                      onChange={(e) => updateOption(index, 'type', e.target.value)}
                                    >
                                      <MenuItem value="string">📝 Text</MenuItem>
                                      <MenuItem value="integer">🔢 Number</MenuItem>
                                      <MenuItem value="user">👤 User</MenuItem>
                                      <MenuItem value="channel">💬 Channel</MenuItem>
                                      <MenuItem value="role">🎭 Role</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Grid>
                                <Grid item xs={12}>
                                  <TextField
                                    fullWidth
                                    label="Description"
                                    value={option.description}
                                    onChange={(e) => updateOption(index, 'description', e.target.value)}
                                    placeholder="What should the user provide?"
                                    size="small"
                                    inputProps={{ maxLength: 100 }}
                                  />
                                </Grid>
                                <Grid item xs={12}>
                                  <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <FormControlLabel
                                      control={
                                        <Switch
                                          checked={option.required}
                                          onChange={(e) => updateOption(index, 'required', e.target.checked)}
                                          size="small"
                                        />
                                      }
                                      label="Required option"
                                    />
                                    <IconButton 
                                      onClick={() => removeOption(index)} 
                                      color="error"
                                      size="small"
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </Box>
                                </Grid>
                              </Grid>
                            </Box>
                          ))}
                          
                          {newCommand.options.length < 25 && (
                            <Button 
                              onClick={addOption} 
                              startIcon={<AddIcon />} 
                              variant="outlined"
                              size="small"
                            >
                              Add Option
                            </Button>
                          )}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  </Grid>
                )}
                
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={createCommand}
                    startIcon={<AddIcon />}
                    disabled={
                      !newCommand.name || 
                      !newCommand.response || 
                      !validateCommandName(newCommand.name) ||
                      (newCommand.commandType === 'slash' && slashStatus.registering)
                    }
                    sx={{ height: 56, fontSize: '1.1rem' }}
                  >
                    Create {newCommand.commandType === 'slash' ? 'Slash' : 'Custom'} Command
                    {newCommand.commandType === 'slash' && (
                      <Chip 
                        label={slashStatus.registering ? "Registering..." : "May take up to 1 hour"} 
                        size="small" 
                        sx={{ ml: 2 }} 
                        color="warning"
                      />
                    )}
                  </Button>
                  
                  {newCommand.commandType === 'slash' && (
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                      💡 Tip: Restart Discord app or re-invite the bot for immediate testing
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </motion.div>
          )}

          {/* Manage Commands Tab */}
          {tabValue === (canCreateCommands ? 1 : 0) && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Permission Info */}
              <Alert 
                severity={user?.role === 'viewer' ? 'warning' : 'info'} 
                sx={{ mb: 3 }}
                icon={user?.role === 'viewer' ? <VisibilityIcon /> : undefined}
              >
                <strong>Your Role: {user?.role}</strong> - 
                {user?.role === 'viewer' && ' You have read-only access to commands.'}
                {user?.role === 'moderator' && ' You can view and create commands, but cannot delete them.'}
                {user?.role === 'admin' && ' You have full access to all command management features.'}
              </Alert>

              {/* Refresh Controls */}
              <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                {canRefreshSlash && (
                  <Button
                    variant="outlined"
                    startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
                    onClick={refreshSlashCommands}
                    disabled={refreshing || slashStatus.registering}
                    color="primary"
                  >
                    {refreshing ? 'Refreshing...' : 'Refresh Slash Commands'}
                  </Button>
                )}
                
                <Chip 
                  icon={getStatusIcon()}
                  label={
                    slashStatus.registering 
                      ? 'Registering commands...' 
                      : `${slashStatus.totalSlashCommands} slash commands active`
                  }
                  color={
                    slashStatus.registering 
                      ? 'warning' 
                      : slashStatus.totalSlashCommands > 0 
                        ? 'success' 
                        : 'default'
                  }
                  variant="outlined"
                />

                <Typography variant="caption" color="textSecondary">
                  Slash commands may take up to 1 hour to appear in Discord
                </Typography>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Built-in Commands */}
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                ⚙️ Built-in Commands 
                <Chip 
                  label={`${Object.keys(commands.builtin).length} commands • ${getTotalUsage(commands.builtin)} uses`}
                  size="small" 
                  color="primary" 
                  sx={{ ml: 2 }} 
                />
              </Typography>
              <List dense>
                {Object.values(commands.builtin).map((command) => (
                  <ListItem key={command.name} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, mb: 1 }}>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body1" component="span" fontFamily="monospace">
                            !{command.name}
                          </Typography>
                          <Typography variant="body1" component="span" fontFamily="monospace" color="primary">
                            /{command.name}
                          </Typography>
                        </Box>
                      }
                      secondary={`${command.description} • Used ${command.usage || 0} times • Category: ${command.category || 'general'}`}
                    />
                    <Chip label="Built-in" size="small" color="primary" />
                  </ListItem>
                ))}
              </List>

              {/* Custom Commands */}
              <Typography variant="h6" gutterBottom sx={{ mt: 4, display: 'flex', alignItems: 'center' }}>
                🎨 Custom Commands
                <Chip 
                  label={`${Object.keys(commands.custom).length} commands • ${getTotalUsage(commands.custom)} uses`}
                  size="small" 
                  color="secondary" 
                  sx={{ ml: 2 }} 
                />
              </Typography>
              <List dense>
                {Object.values(commands.custom).length === 0 ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No custom prefix commands yet. {canCreateCommands ? 'Create one in the "Create Command" tab!' : 'Ask an admin or moderator to create commands.'}
                  </Alert>
                ) : (
                  Object.values(commands.custom).map((command) => (
                    <ListItem key={command.name} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, mb: 1 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body1" component="span" fontFamily="monospace">
                            !{command.name}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2">
                              {command.description} • Used {command.usage || 0} times
                            </Typography>
                            {command.conditions && command.conditions.length > 0 && (
                              <Typography variant="caption" color="warning.main">
                                Role requirements: {command.conditions.map(c => c.value).join(', ')}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Box display="flex" gap={1} alignItems="center">
                          <Chip 
                            label={command.embed ? "Embed" : "Text"} 
                            size="small" 
                            color={command.embed ? "info" : "default"}
                          />
                          {command.cooldown > 0 && (
                            <Chip 
                              label={`${command.cooldown}s cooldown`} 
                              size="small" 
                              color="warning"
                            />
                          )}
                          {canDeleteCommands && (
                            <IconButton
                              edge="end"
                              onClick={() => setDeleteDialog({ 
                                open: true, 
                                command: command.name, 
                                type: 'custom' 
                              })}
                              color="error"
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          )}
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))
                )}
              </List>

              {/* Slash Commands */}
              <Typography variant="h6" gutterBottom sx={{ mt: 4, display: 'flex', alignItems: 'center' }}>
                ⚡ Slash Commands
                <Chip 
                  label={`${Object.keys(commands.slash).length} commands • ${getTotalUsage(commands.slash)} uses`}
                  size="small" 
                  color="info" 
                  sx={{ ml: 2 }} 
                />
              </Typography>
              <List dense>
                {Object.values(commands.slash).length === 0 ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No custom slash commands yet. {canCreateCommands ? 'Create one in the "Create Command" tab!' : 'Ask an admin or moderator to create commands.'}
                    <br />
                    <strong>Note:</strong> Slash commands can take up to 1 hour to appear in Discord.
                  </Alert>
                ) : (
                  Object.values(commands.slash).map((command) => (
                    <ListItem key={command.name} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, mb: 1 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body1" component="span" fontFamily="monospace" color="primary">
                            /{command.name}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2">
                              {command.description} • Used {command.usage || 0} times • {command.options?.length || 0} options
                            </Typography>
                            {command.options && command.options.length > 0 && (
                              <Typography variant="caption" color="info.main">
                                Options: {command.options.map(opt => `${opt.name} (${opt.type})`).join(', ')}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Box display="flex" gap={1} alignItems="center">
                          <Chip 
                            label={command.embed ? "Embed" : "Text"} 
                            size="small" 
                            color={command.embed ? "info" : "default"}
                          />
                          {command.cooldown > 0 && (
                            <Chip 
                              label={`${command.cooldown}s cooldown`} 
                              size="small" 
                              color="warning"
                            />
                          )}
                          {canDeleteCommands && (
                            <IconButton
                              edge="end"
                              onClick={() => setDeleteDialog({ 
                                open: true, 
                                command: command.name, 
                                type: 'slash' 
                              })}
                              color="error"
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          )}
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))
                )}
              </List>
            </motion.div>
          )}

          {/* Command Logs Tab */}
          {canViewLogs && tabValue === (canCreateCommands ? 2 : 1) && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Typography variant="h6" gutterBottom>
                Recent Command Usage ({commandLogs.length})
              </Typography>
              {commandLogs.length === 0 ? (
                <Alert severity="info">
                  No commands have been used yet. Try using a command in Discord!
                </Alert>
              ) : (
                <List dense>
                  {commandLogs.slice(0, 50).map((log, index) => (
                    <ListItem key={index} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, mb: 1 }}>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body1" fontFamily="monospace">
                              {log.type === 'slash' ? '/' : '!'}{log.command}
                            </Typography>
                            <Chip 
                              label={log.type} 
                              size="small" 
                              color={log.type === 'slash' ? 'primary' : 'secondary'}
                            />
                          </Box>
                        }
                        secondary={`${log.user} in ${log.guild} at ${formatTime(log.timestamp)}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </motion.div>
          )}
        </Box>
      </CardContent>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, command: null, type: null })}
      >
        <DialogTitle>
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the command "{deleteDialog.command}"? This action cannot be undone.
            {deleteDialog.type === 'slash' && (
              <Box sx={{ mt: 2 }}>
                <Alert severity="warning">
                  It may take up to 1 hour for this slash command to disappear from Discord.
                </Alert>
              </Box>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, command: null, type: null })}>
            Cancel
          </Button>
          <Button 
            onClick={() => deleteCommand(deleteDialog.command, deleteDialog.type)}
            color="error" 
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default CommandBuilder;
