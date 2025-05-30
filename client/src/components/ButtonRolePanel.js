import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Switch,
  FormControlLabel,
  Checkbox,
  Avatar,
  Paper,
  Tooltip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Send as SendIcon,
  Preview as PreviewIcon,
  ExpandMore as ExpandMoreIcon,
  SmartButton as ButtonIcon,
  Analytics as AnalyticsIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  TrendingUp as TrendingUpIcon,
  Tune as TuneIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const ButtonRolePanel = ({ socket, user }) => {
  const [tabValue, setTabValue] = useState(0);
  const [buttonRoleSetups, setButtonRoleSetups] = useState([]);
  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  
  const [createDialog, setCreateDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState({ open: false, setup: null });
  const [statsDialog, setStatsDialog] = useState({ open: false, setup: null });
  const [redeployDialog, setRedeployDialog] = useState({ open: false, setup: null });
  const [editDialog, setEditDialog] = useState({ open: false, setup: null });
  
  const [embedData, setEmbedData] = useState({
    title: '',
    description: '',
    color: '#5865f2',
    thumbnail: '',
    image: '',
    footer: '',
    // Enhanced customization options
    showAvailableRoles: true,
    availableRolesTitle: '🎭 Available Roles',
    showRoleCount: true,
    showInstructions: true,
    showMemberCount: true,
    showRoleInButton: false,
    showFooter: true,
    showFooterInstructions: true,
    customFooter: '',
    showAuthor: true,
    customAuthor: '',
    showAuthorIcon: true,
    showServerIcon: true,
    showTimestamp: false
  });
  
  const [buttons, setButtons] = useState([
    { emoji: '🎯', label: 'Role 1', customLabel: '', roleId: '', style: 'Primary' }
  ]);
  
  const [selectedChannel, setSelectedChannel] = useState('');
  const [editingSetup, setEditingSetup] = useState(null);
  
  // Separate logging configs
  const [loggingConfig, setLoggingConfig] = useState({
    enabled: true,
    logChannelId: '',
    logRoleAdded: true,
    logRoleRemoved: true,
    logButtonRoles: true
  });

  const [setupLoggingConfig, setSetupLoggingConfig] = useState({
    enabled: false,
    logChannelId: '',
    logRoleAdded: true,
    logRoleRemoved: true,
    logButtonRoles: true
  });

  // Settings state
  const [settingsChanged, setSettingsChanged] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const buttonStyles = [
    { value: 'Primary', label: 'Primary (Blue)', color: '#5865f2' },
    { value: 'Secondary', label: 'Secondary (Gray)', color: '#4f545c' },
    { value: 'Success', label: 'Success (Green)', color: '#57f287' },
    { value: 'Danger', label: 'Danger (Red)', color: '#ed4245' }
  ];

  const apiRequest = async (url, options = {}) => {
    const baseURL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3000/api';
    const token = localStorage.getItem('authToken');
    
    const response = await fetch(baseURL + url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }
    
    return response.json();
  };

  const loadGuilds = async () => {
    try {
      const response = await apiRequest('/guilds');
      setGuilds(response);
      if (response.length > 0 && !selectedGuild) {
        setSelectedGuild(response[0].id);
      }
    } catch (error) {
      toast.error('Failed to load servers');
    }
  };

  const loadGuildData = async (guildId) => {
    if (!guildId) return;
    
    try {
      const response = await apiRequest(`/guild-data/${guildId}`);
      setChannels(response.channels || []);
      setRoles(response.roles || []);
    } catch (error) {
      toast.error('Failed to load server data');
    }
  };

  const loadButtonRoles = async () => {
    if (!selectedGuild) return;
    
    try {
      console.log(`🔍 Loading button roles for guild: ${selectedGuild}`);
      const response = await apiRequest(`/button-roles/${selectedGuild}`);
      console.log(`🔍 API Response:`, response);
      setButtonRoleSetups(response.buttonRoles || []);
      console.log(`🔍 Set ${response.buttonRoles?.length || 0} button role setups`);
    } catch (error) {
      console.error('Failed to load button roles:', error);
      toast.error('Failed to load button role setups');
    }
  };

  const loadLoggingConfig = async (guildId) => {
    if (!guildId) return;
    
    try {
      const response = await apiRequest(`/role-logging-config/${guildId}`);
      if (response.success && response.config) {
        setLoggingConfig(response.config);
      }
    } catch (error) {
      console.log('No existing logging config found, using defaults');
    }
  };

  useEffect(() => {
    loadGuilds();
  }, []);

  useEffect(() => {
    if (selectedGuild) {
      loadGuildData(selectedGuild);
      loadButtonRoles();
      loadLoggingConfig(selectedGuild);
      setSettingsChanged(false);
    }
  }, [selectedGuild]);

  // Settings functions
  const updateLoggingConfig = (updates) => {
    setLoggingConfig(prev => ({ ...prev, ...updates }));
    setSettingsChanged(true);
  };

  const saveSettings = async () => {
    try {
      setSavingSettings(true);
      
      await apiRequest('/role-logging-config', {
        method: 'POST',
        body: JSON.stringify({
          guildId: selectedGuild,
          loggingConfig
        })
      });
      
      toast.success('Settings saved successfully!');
      setSettingsChanged(false);
    } catch (error) {
      toast.error('Failed to save settings: ' + error.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Redeploy and Edit functions
  const handleRedeploy = (setup) => {
    setSelectedChannel(setup.channelId);
    setRedeployDialog({ open: true, setup });
  };

  const handleEditSetup = (setup) => {
    // Populate form with existing data
    setEmbedData(setup.embedData);
    setButtons(setup.buttons);
    setSelectedChannel(setup.channelId);
    
    // Set up logging config if it exists
    if (setup.loggingConfig) {
      setSetupLoggingConfig(setup.loggingConfig);
    } else {
      setSetupLoggingConfig({
        enabled: false,
        logChannelId: '',
        logRoleAdded: true,
        logRoleRemoved: true,
        logButtonRoles: true
      });
    }
    
    setEditingSetup(setup);
    setEditDialog({ open: true, setup });
  };

  const redeployToChannel = async (setup, channelId) => {
    try {
      setLoading(true);
      
      const response = await apiRequest('/button-roles/redeploy', {
        method: 'POST',
        body: JSON.stringify({
          setupId: setup.id.split('_')[2],
          channelId: channelId,
          guildId: selectedGuild
        })
      });
      
      toast.success('Button role setup redeployed successfully!');
      setRedeployDialog({ open: false, setup: null });
      loadButtonRoles();
      
    } catch (error) {
      toast.error('Failed to redeploy: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateButtonRoleSetup = async () => {
    if (!embedData.title) {
      toast.error('Embed title is required');
      return;
    }
    
    const invalidButtons = buttons.filter(b => !b.roleId || !b.label);
    if (invalidButtons.length > 0) {
      toast.error('All buttons must have a role and label');
      return;
    }
    
    const roleIds = buttons.map(b => b.roleId);
    const duplicateRoles = roleIds.filter((roleId, index) => roleIds.indexOf(roleId) !== index);
    
    if (duplicateRoles.length > 0) {
      toast.error('Each role can only be assigned to one button. Please remove duplicate roles.');
      return;
    }
    
    try {
      setLoading(true);
      
      const cleanEmbedData = {
        ...embedData,
        description: embedData.description?.trim() || null,
        thumbnail: embedData.thumbnail?.trim() || null,
        image: embedData.image?.trim() || null,
        footer: embedData.footer?.trim() || null
      };
      
      const response = await apiRequest(`/button-roles/${editingSetup.id.split('_')[2]}`, {
        method: 'PUT',
        body: JSON.stringify({
          embedData: cleanEmbedData,
          buttons,
          channelId: selectedChannel,
          guildId: selectedGuild
        })
      });
      
      toast.success('Button role setup updated successfully!');
      setEditDialog({ open: false, setup: null });
      setEditingSetup(null);
      resetForm();
      loadButtonRoles();
      
    } catch (error) {
      toast.error('Failed to update setup: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addButton = () => {
    if (buttons.length >= 25) {
      toast.error('Maximum 25 buttons allowed');
      return;
    }
    
    setButtons([...buttons, {
      emoji: '🎯',
      label: `Role ${buttons.length + 1}`,
      customLabel: '',
      roleId: '',
      style: 'Primary'
    }]);
  };

  const removeButton = (index) => {
    if (buttons.length === 1) {
      toast.error('At least one button is required');
      return;
    }
    
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index, field, value) => {
    const updatedButtons = [...buttons];
    updatedButtons[index][field] = value;
    setButtons(updatedButtons);
  };

  const updateButtonCustomLabel = (index, customLabel) => {
    const updatedButtons = [...buttons];
    updatedButtons[index].customLabel = customLabel;
    setButtons(updatedButtons);
  };

  const createButtonRoleSetup = async () => {
    if (!embedData.title) {
      toast.error('Embed title is required');
      return;
    }
    
    if (!selectedChannel) {
      toast.error('Please select a channel');
      return;
    }
    
    const invalidButtons = buttons.filter(b => !b.roleId || !b.label);
    if (invalidButtons.length > 0) {
      toast.error('All buttons must have a role and label');
      return;
    }
    
    const roleIds = buttons.map(b => b.roleId);
    const duplicateRoles = roleIds.filter((roleId, index) => roleIds.indexOf(roleId) !== index);
    
    if (duplicateRoles.length > 0) {
      toast.error('Each role can only be assigned to one button. Please remove duplicate roles.');
      return;
    }
    
    try {
      setLoading(true);
      
      const cleanEmbedData = {
        ...embedData,
        description: embedData.description?.trim() || null,
        thumbnail: embedData.thumbnail?.trim() || null,
        image: embedData.image?.trim() || null,
        footer: embedData.footer?.trim() || null
      };
      
      const response = await apiRequest('/button-roles', {
        method: 'POST',
        body: JSON.stringify({
          embedData: cleanEmbedData,
          buttons,
          guildId: selectedGuild,
          channelId: selectedChannel,
          loggingConfig: setupLoggingConfig.enabled ? setupLoggingConfig : null
        })
      });
      
      toast.success('Button role setup created successfully!');
      setCreateDialog(false);
      resetForm();
      loadButtonRoles();
      
    } catch (error) {
      toast.error(error.message || 'Failed to create button role setup');
    } finally {
      setLoading(false);
    }
  };

  const deleteSetup = async (setupId) => {
    if (!window.confirm('Are you sure you want to delete this button role setup?')) {
      return;
    }
    
    try {
      await apiRequest(`/button-roles/${setupId}`, { method: 'DELETE' });
      toast.success('Button role setup deleted');
      loadButtonRoles();
    } catch (error) {
      toast.error('Failed to delete setup');
    }
  };

  const resetForm = () => {
    setEmbedData({
      title: '',
      description: '',
      color: '#5865f2',
      thumbnail: '',
      image: '',
      footer: '',
      showAvailableRoles: true,
      availableRolesTitle: '🎭 Available Roles',
      showRoleCount: true,
      showInstructions: true,
      showMemberCount: true,
      showRoleInButton: false,
      showFooter: true,
      showFooterInstructions: true,
      customFooter: '',
      showAuthor: true,
      customAuthor: '',
      showAuthorIcon: true,
      showServerIcon: true,
      showTimestamp: false
    });
    setButtons([{ emoji: '🎯', label: 'Role 1', customLabel: '', roleId: '', style: 'Primary' }]);
    setSelectedChannel('');
    setSetupLoggingConfig({
      enabled: false,
      logChannelId: '',
      logRoleAdded: true,
      logRoleRemoved: true,
      logButtonRoles: true
    });
  };

  const getSetupStats = (setup) => {
    const totalUsage = Object.values(setup.usageStats || {}).reduce((sum, stat) => 
      sum + (stat.added || 0) + (stat.removed || 0), 0
    );
    return totalUsage;
  };

  const getRoleFromId = (roleId) => {
    return roles.find(role => role.id === roleId);
  };

  const getChannelFromId = (channelId) => {
    return channels.find(channel => channel.id === channelId);
  };

  // Permission checks
  const canManageRoles = user && ['admin', 'moderator'].includes(user.role);
  const canViewStats = user && ['admin', 'moderator'].includes(user.role);

  if (!canManageRoles) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            You do not have permission to manage button roles.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            <ButtonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Button Role System
          </Typography>
          
          <Box display="flex" gap={1}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Server</InputLabel>
              <Select
                value={selectedGuild}
                onChange={(e) => setSelectedGuild(e.target.value)}
                label="Server"
              >
                {guilds.map(guild => (
                  <MenuItem key={guild.id} value={guild.id}>
                    {guild.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <IconButton onClick={loadButtonRoles} color="primary">
              <RefreshIcon />
            </IconButton>
            
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialog(true)}
              disabled={!selectedGuild}
            >
              Create Setup
            </Button>
          </Box>
        </Box>

        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Button Roles" />
          <Tab label="Analytics" disabled={!canViewStats} />
          <Tab label="Settings" />
        </Tabs>

        <Box sx={{ mt: 3 }}>
          {/* Button Roles Tab */}
          {tabValue === 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Button Role Setups ({buttonRoleSetups.length})
                </Typography>
                
                <Box display="flex" gap={1}>
                  <Chip 
                    label={`${buttonRoleSetups.length} Setups`} 
                    color="primary" 
                    size="small" 
                  />
                  <Chip 
                    label={`${buttonRoleSetups.reduce((sum, setup) => sum + setup.buttons.length, 0)} Buttons`} 
                    color="secondary" 
                    size="small" 
                  />
                </Box>
              </Box>
              
              {buttonRoleSetups.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No button role setups found. Create your first one to get started!
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  {buttonRoleSetups.map((setup) => (
                    <Grid item xs={12} md={6} lg={4} key={setup.id}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent>
                          <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                            <Typography variant="h6" gutterBottom>
                              {setup.embedData.title}
                            </Typography>
                            <Chip 
                              label={getSetupStats(setup)} 
                              size="small" 
                              color="primary"
                              icon={<TrendingUpIcon />}
                            />
                          </Box>
                          
                          <Typography variant="body2" color="textSecondary" gutterBottom>
                            {setup.embedData.description || 'No description'}
                          </Typography>
                          
                          <Box mb={2}>
                            <Typography variant="caption" color="textSecondary">
                              Channel: #{getChannelFromId(setup.channelId)?.name || 'Unknown'}
                            </Typography>
                          </Box>
                          
                          <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                            {setup.buttons.slice(0, 3).map((button, index) => {
                              const role = getRoleFromId(button.roleId);
                              return (
                                <Tooltip key={index} title={role?.name || 'Unknown Role'}>
                                  <Chip
                                    label={`${button.emoji} ${button.customLabel || button.label}`}
                                    size="small"
                                    sx={{
                                      backgroundColor: buttonStyles.find(s => s.value === button.style)?.color || '#5865f2',
                                      color: 'white'
                                    }}
                                  />
                                </Tooltip>
                              );
                            })}
                            {setup.buttons.length > 3 && (
                              <Chip
                                label={`+${setup.buttons.length - 3} more`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                          
                          <Box display="flex" gap={1} justifyContent="space-between">
                            <Box display="flex" gap={1}>
                              <Button
                                size="small"
                                startIcon={<PreviewIcon />}
                                onClick={() => setPreviewDialog({ open: true, setup })}
                              >
                                Preview
                              </Button>
                              <Button
                                size="small"
                                startIcon={<AnalyticsIcon />}
                                onClick={() => setStatsDialog({ open: true, setup })}
                              >
                                Stats
                              </Button>
                              <Button
                                size="small"
                                startIcon={<SendIcon />}
                                onClick={() => handleRedeploy(setup)}
                                color="primary"
                              >
                                Redeploy
                              </Button>
                            </Box>
                            <Box display="flex" gap={1}>
                              <Button
                                size="small"
                                startIcon={<EditIcon />}
                                onClick={() => handleEditSetup(setup)}
                                color="secondary"
                              >
                                Edit
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => deleteSetup(setup.id.split('_')[2])}
                              >
                                Delete
                              </Button>
                            </Box>
                          </Box>
                          
                          <Box mt={2} pt={2} borderTop="1px solid #e0e0e0">
                            <Typography variant="caption" color="textSecondary">
                              Created: {new Date(setup.createdAt).toLocaleDateString()}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </motion.div>
          )}

          {/* Analytics Tab */}
          {tabValue === 1 && canViewStats && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Typography variant="h6" gutterBottom>
                Button Role Analytics
              </Typography>
              
              {buttonRoleSetups.length === 0 ? (
                <Alert severity="info">
                  No data available. Create some button role setups to see analytics.
                </Alert>
              ) : (
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Total Setups
                        </Typography>
                        <Typography variant="h4">
                          {buttonRoleSetups.length}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Total Buttons
                        </Typography>
                        <Typography variant="h4" color="primary">
                          {buttonRoleSetups.reduce((sum, setup) => sum + setup.buttons.length, 0)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Total Usage
                        </Typography>
                        <Typography variant="h4" color="success.main">
                          {buttonRoleSetups.reduce((sum, setup) => sum + getSetupStats(setup), 0)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Avg. Usage/Setup
                        </Typography>
                        <Typography variant="h4" color="warning.main">
                          {buttonRoleSetups.length > 0 ? 
                            Math.round(buttonRoleSetups.reduce((sum, setup) => sum + getSetupStats(setup), 0) / buttonRoleSetups.length) : 0
                          }
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Setup Performance
                        </Typography>
                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>Setup Name</TableCell>
                                <TableCell>Buttons</TableCell>
                                <TableCell>Total Usage</TableCell>
                                <TableCell>Created</TableCell>
                                <TableCell>Channel</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {buttonRoleSetups.map((setup) => (
                                <TableRow key={setup.id}>
                                  <TableCell>{setup.embedData.title}</TableCell>
                                  <TableCell>
                                    <Chip label={setup.buttons.length} size="small" />
                                  </TableCell>
                                  <TableCell>
                                    <Box display="flex" alignItems="center" gap={1}>
                                      <TrendingUpIcon fontSize="small" />
                                      {getSetupStats(setup)}
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    {new Date(setup.createdAt).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell>
                                    #{getChannelFromId(setup.channelId)?.name || 'Unknown'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </motion.div>
          )}

          {/* Settings Tab */}
          {tabValue === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Button Role Settings
                </Typography>
                
                {settingsChanged && (
                  <Button
                    variant="contained"
                    startIcon={savingSettings ? <CircularProgress size={16} /> : <SaveIcon />}
                    onClick={saveSettings}
                    disabled={savingSettings || !selectedGuild}
                  >
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </Button>
                )}
              </Box>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                Global settings for button role system. These apply to all new setups.
              </Alert>
              
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Default Logging Configuration
                  </Typography>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={loggingConfig.enabled}
                        onChange={(e) => updateLoggingConfig({ enabled: e.target.checked })}
                      />
                    }
                    label="Enable Role Logging by Default"
                  />
                  
                  {loggingConfig.enabled && (
                    <Box mt={2}>
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Default Log Channel</InputLabel>
                        <Select
                          value={loggingConfig.logChannelId}
                          onChange={(e) => updateLoggingConfig({ logChannelId: e.target.value })}
                          label="Default Log Channel"
                        >
                          <MenuItem value="">
                            <em>Select a channel</em>
                          </MenuItem>
                          {channels.map(channel => (
                            <MenuItem key={channel.id} value={channel.id}>
                              # {channel.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      
                      <Box display="flex" gap={2} flexWrap="wrap">
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={loggingConfig.logRoleAdded}
                              onChange={(e) => updateLoggingConfig({ logRoleAdded: e.target.checked })}
                            />
                          }
                          label="Log Role Additions"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={loggingConfig.logRoleRemoved}
                              onChange={(e) => updateLoggingConfig({ logRoleRemoved: e.target.checked })}
                            />
                          }
                          label="Log Role Removals"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={loggingConfig.logButtonRoles}
                              onChange={(e) => updateLoggingConfig({ logButtonRoles: e.target.checked })}
                            />
                          }
                          label="Log Button Role Events"
                        />
                      </Box>
                    </Box>
                  )}
                  
                  {settingsChanged && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      You have unsaved changes. Click "Save Settings" to apply them.
                    </Alert>
                  )}
                </CardContent>
              </Card>
              
              <Card sx={{ mt: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    System Information
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Selected Server:</strong> {guilds.find(g => g.id === selectedGuild)?.name || 'None'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Available Channels:</strong> {channels.length}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Available Roles:</strong> {roles.length}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Button Role Setups:</strong> {buttonRoleSetups.length}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </Box>

        {/* Create Dialog */}
        <Dialog
          open={createDialog}
          onClose={() => setCreateDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>Create Button Role Setup</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {/* Basic Embed Settings */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  📝 Basic Settings
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Title *"
                  value={embedData.title}
                  onChange={(e) => setEmbedData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Choose Your Roles"
                />
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="color"
                  label="Color"
                  value={embedData.color}
                  onChange={(e) => setEmbedData(prev => ({ ...prev, color: e.target.value }))}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={embedData.description}
                  onChange={(e) => setEmbedData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Select the roles you want by clicking the buttons below!"
                />
              </Grid>

              {/* Display Customization */}
              <Grid item xs={12}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <TuneIcon />
                      <Typography variant="h6">🎨 Display Customization</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {/* Available Roles Section */}
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showAvailableRoles}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showAvailableRoles: e.target.checked }))}
                            />
                          }
                          label="Show Available Roles List"
                        />
                      </Grid>

                      {embedData.showAvailableRoles && (
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Available Roles Title"
                            value={embedData.availableRolesTitle}
                            onChange={(e) => setEmbedData(prev => ({ ...prev, availableRolesTitle: e.target.value }))}
                            placeholder="🎭 Available Roles"
                          />
                        </Grid>
                      )}

                      {/* Button Customization */}
                      <Grid item xs={12} sm={4}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showMemberCount}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showMemberCount: e.target.checked }))}
                            />
                          }
                          label="Show Member Count on Buttons"
                        />
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showRoleInButton}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showRoleInButton: e.target.checked }))}
                            />
                          }
                          label="Show Role Name in Button"
                        />
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showRoleCount}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showRoleCount: e.target.checked }))}
                            />
                          }
                          label="Show Role Count in Description"
                        />
                      </Grid>

                      {/* Instructions and Footer */}
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showInstructions}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showInstructions: e.target.checked }))}
                            />
                          }
                          label="Show Usage Instructions"
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showFooter}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showFooter: e.target.checked }))}
                            />
                          }
                          label="Show Footer"
                        />
                      </Grid>

                      {embedData.showFooter && (
                        <>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="Custom Footer Text (optional)"
                              value={embedData.customFooter}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, customFooter: e.target.value }))}
                              placeholder="Leave empty for auto-generated footer"
                            />
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={embedData.showFooterInstructions}
                                  onChange={(e) => setEmbedData(prev => ({ ...prev, showFooterInstructions: e.target.checked }))}
                                />
                              }
                              label="Show Instructions in Footer"
                            />
                          </Grid>
                        </>
                      )}

                      {/* Author Section */}
                      <Grid item xs={12} sm={4}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showAuthor}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showAuthor: e.target.checked }))}
                            />
                          }
                          label="Show Author"
                        />
                      </Grid>

                      {embedData.showAuthor && (
                        <>
                          <Grid item xs={12} sm={4}>
                            <TextField
                              fullWidth
                              label="Custom Author Text"
                              value={embedData.customAuthor}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, customAuthor: e.target.value }))}
                              placeholder="Server Name Role Selection"
                            />
                          </Grid>
                          
                          <Grid item xs={12} sm={4}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={embedData.showAuthorIcon}
                                  onChange={(e) => setEmbedData(prev => ({ ...prev, showAuthorIcon: e.target.checked }))}
                                />
                              }
                              label="Show Author Icon"
                            />
                          </Grid>
                        </>
                      )}

                      {/* Timestamp */}
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showTimestamp}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showTimestamp: e.target.checked }))}
                            />
                          }
                          label="Show Timestamp"
                        />
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>

              {/* Channel Selection */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  📍 Channel & Logging
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Channel *</InputLabel>
                  <Select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    label="Channel *"
                  >
                    {channels.map(channel => (
                      <MenuItem key={channel.id} value={channel.id}>
                        # {channel.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={setupLoggingConfig.enabled}
                      onChange={(e) => setSetupLoggingConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                    />
                  }
                  label="Enable Logging for this Setup"
                />
              </Grid>

              {setupLoggingConfig.enabled && (
                <>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Log Channel</InputLabel>
                      <Select
                        value={setupLoggingConfig.logChannelId}
                        onChange={(e) => setSetupLoggingConfig(prev => ({ ...prev, logChannelId: e.target.value }))}
                        label="Log Channel"
                      >
                        <MenuItem value="">
                          <em>Select a channel</em>
                        </MenuItem>
                        {channels.map(channel => (
                          <MenuItem key={channel.id} value={channel.id}>
                            # {channel.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={setupLoggingConfig.logRoleAdded}
                            onChange={(e) => setSetupLoggingConfig(prev => ({ ...prev, logRoleAdded: e.target.checked }))}
                          />
                        }
                        label="Log Additions"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={setupLoggingConfig.logRoleRemoved}
                            onChange={(e) => setSetupLoggingConfig(prev => ({ ...prev, logRoleRemoved: e.target.checked }))}
                          />
                        }
                        label="Log Removals"
                      />
                    </Box>
                  </Grid>
                </>
              )}

              {/* Buttons */}
              <Grid item xs={12}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} mt={2}>
                  <Typography variant="h6">
                    🎯 Buttons ({buttons.length}/25)
                  </Typography>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addButton}
                    disabled={buttons.length >= 25}
                    variant="outlined"
                  >
                    Add Button
                  </Button>
                </Box>
                
                {buttons.map((button, index) => (
                  <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="subtitle1">
                          Button {index + 1}
                        </Typography>
                        <IconButton
                          color="error"
                          onClick={() => removeButton(index)}
                          disabled={buttons.length === 1}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={2}>
                          <TextField
                            fullWidth
                            label="Emoji"
                            value={button.emoji}
                            onChange={(e) => updateButton(index, 'emoji', e.target.value)}
                            placeholder="🎯"
                          />
                        </Grid>
                        
                        <Grid item xs={12} sm={2}>
                          <TextField
                            fullWidth
                            label="Label"
                            value={button.label}
                            onChange={(e) => updateButton(index, 'label', e.target.value)}
                            placeholder="Role Name"
                          />
                        </Grid>
                        
                        <Grid item xs={12} sm={3}>
                          <TextField
                            fullWidth
                            label="Custom Button Text"
                            value={button.customLabel}
                            onChange={(e) => updateButtonCustomLabel(index, e.target.value)}
                            placeholder="Leave empty to use label"
                            helperText="Override button display text"
                          />
                        </Grid>
                        
                        <Grid item xs={12} sm={3}>
                          <FormControl fullWidth error={buttons.filter(b => b.roleId === button.roleId).length > 1}>
                            <InputLabel>Role *</InputLabel>
                            <Select
                              value={button.roleId}
                              onChange={(e) => updateButton(index, 'roleId', e.target.value)}
                              label="Role *"
                            >
                              {roles.map(role => {
                                const isUsed = buttons.some((b, i) => b.roleId === role.id && i !== index);
                                return (
                                  <MenuItem 
                                    key={role.id} 
                                    value={role.id}
                                    disabled={isUsed}
                                  >
                                    <Box display="flex" alignItems="center" gap={1}>
                                      <Box
                                        sx={{
                                          width: 12,
                                          height: 12,
                                          borderRadius: '50%',
                                          backgroundColor: role.color || '#99aab5'
                                        }}
                                      />
                                      {role.name} {isUsed && '(Already used)'}
                                    </Box>
                                  </MenuItem>
                                );
                              })}
                            </Select>
                            {buttons.filter(b => b.roleId === button.roleId).length > 1 && (
                              <Typography variant="caption" color="error">
                                This role is already assigned to another button
                              </Typography>
                            )}
                          </FormControl>
                        </Grid>
                        
                        <Grid item xs={12} sm={2}>
                          <FormControl fullWidth>
                            <InputLabel>Style</InputLabel>
                            <Select
                              value={button.style}
                              onChange={(e) => updateButton(index, 'style', e.target.value)}
                              label="Style"
                            >
                              {buttonStyles.map(style => (
                                <MenuItem key={style.value} value={style.value}>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Box
                                      sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: 1,
                                        backgroundColor: style.color
                                      }}
                                    />
                                    {style.label}
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
              </Grid>

              {/* Enhanced Live Preview */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  👀 Live Preview
                </Typography>
                <Paper sx={{ 
                  p: 2, 
                  backgroundColor: '#36393f', 
                  color: 'white', 
                  borderRadius: 2,
                  fontFamily: 'Whitney, "Helvetica Neue", Helvetica, Arial, sans-serif'
                }}>
                  {embedData.showAuthor && (
                    <Box display="flex" alignItems="center" mb={1}>
                      {embedData.showAuthorIcon && (
                        <Avatar sx={{ width: 20, height: 20, mr: 1 }}>
                          🤖
                        </Avatar>
                      )}
                      <Typography variant="subtitle2" sx={{ color: '#ffffff' }}>
                        {embedData.customAuthor || `${selectedGuild ? guilds.find(g => g.id === selectedGuild)?.name : 'Server'} Role Selection`}
                      </Typography>
                    </Box>
                  )}
                  
                  <Typography variant="h6" sx={{ color: embedData.color, fontWeight: 600, mb: 1 }}>
                    {embedData.title || 'Role Selection'}
                  </Typography>
                  
                  <Typography variant="body2" sx={{ color: '#dcddde', mb: 2 }}>
                    {embedData.description || 'Click the buttons below to add or remove roles!'}
                    {embedData.showRoleCount && (
                      <>
                        <br /><br />
                        🎯 **Available Roles:** {buttons.length}
                      </>
                    )}
                    {embedData.showInstructions && (
                      <>
                        <br />
                        📝 Click the buttons below to add or remove roles!<br />
                        💡 *Tip: Click again to remove a role you already have*
                      </>
                    )}
                  </Typography>
                  
                  {embedData.showAvailableRoles && (
                    <Box sx={{ backgroundColor: '#2f3136', p: 2, borderRadius: 1, mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ color: '#ffffff', mb: 1 }}>
                        {embedData.availableRolesTitle}
                      </Typography>
                      {buttons.map((button, index) => (
                        <Typography key={index} variant="body2" sx={{ color: '#dcddde' }}>
                          {button.emoji} **{button.customLabel || button.label}** {button.roleId ? `(<@&${button.roleId}>)` : ''}
                        </Typography>
                      ))}
                    </Box>
                  )}
                  
                  <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                    {buttons.map((button, index) => {
                      let buttonText = button.customLabel || button.label;
                      if (embedData.showMemberCount) buttonText += ' (0)';
                      if (embedData.showRoleInButton && button.roleId) {
                        const role = roles.find(r => r.id === button.roleId);
                        if (role && role.name !== buttonText) buttonText += ` - ${role.name}`;
                      }
                      
                      return (
                        <Button
                          key={index}
                          variant="contained"
                          size="small"
                          sx={{
                            backgroundColor: buttonStyles.find(s => s.value === button.style)?.color || '#5865f2',
                            color: 'white',
                            textTransform: 'none'
                          }}
                          startIcon={<span>{button.emoji}</span>}
                          disabled
                        >
                          {buttonText}
                        </Button>
                      );
                    })}
                  </Box>
                  
                  {embedData.showFooter && (
                    <Typography variant="caption" sx={{ color: '#72767d' }}>
                      {embedData.customFooter || (
                        `${buttons.length} role${buttons.length !== 1 ? 's' : ''} available${embedData.showFooterInstructions ? ' • Click buttons to toggle roles' : ''}`
                      )}
                    </Typography>
                  )}
                  
                  {embedData.showTimestamp && (
                    <Typography variant="caption" sx={{ color: '#72767d', display: 'block', mt: 1 }}>
                      Today at {new Date().toLocaleTimeString()}
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={createButtonRoleSetup}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
            >
              {loading ? 'Creating...' : 'Create & Send'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Dialog - NOW WITH FULL CUSTOMIZATION */}
        <Dialog
          open={editDialog.open}
          onClose={() => {
            setEditDialog({ open: false, setup: null });
            setEditingSetup(null);
            resetForm();
          }}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>Edit Button Role Setup</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {/* Basic Settings */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  📝 Basic Settings
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Title *"
                  value={embedData.title}
                  onChange={(e) => setEmbedData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Choose Your Roles"
                />
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="color"
                  label="Color"
                  value={embedData.color}
                  onChange={(e) => setEmbedData(prev => ({ ...prev, color: e.target.value }))}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={embedData.description}
                  onChange={(e) => setEmbedData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Select the roles you want by clicking the buttons below!"
                />
              </Grid>

              {/* ADD THE MISSING CUSTOMIZATION SECTION */}
              <Grid item xs={12}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <TuneIcon />
                      <Typography variant="h6">🎨 Display Customization</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {/* Available Roles Section */}
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showAvailableRoles}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showAvailableRoles: e.target.checked }))}
                            />
                          }
                          label="Show Available Roles List"
                        />
                      </Grid>

                      {embedData.showAvailableRoles && (
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Available Roles Title"
                            value={embedData.availableRolesTitle}
                            onChange={(e) => setEmbedData(prev => ({ ...prev, availableRolesTitle: e.target.value }))}
                            placeholder="🎭 Available Roles"
                          />
                        </Grid>
                      )}

                      {/* Button Customization */}
                      <Grid item xs={12} sm={4}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showMemberCount}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showMemberCount: e.target.checked }))}
                            />
                          }
                          label="Show Member Count on Buttons"
                        />
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showRoleInButton}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showRoleInButton: e.target.checked }))}
                            />
                          }
                          label="Show Role Name in Button"
                        />
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showRoleCount}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showRoleCount: e.target.checked }))}
                            />
                          }
                          label="Show Role Count in Description"
                        />
                      </Grid>

                      {/* Instructions and Footer */}
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showInstructions}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showInstructions: e.target.checked }))}
                            />
                          }
                          label="Show Usage Instructions"
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showFooter}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showFooter: e.target.checked }))}
                            />
                          }
                          label="Show Footer"
                        />
                      </Grid>

                      {embedData.showFooter && (
                        <>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="Custom Footer Text (optional)"
                              value={embedData.customFooter}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, customFooter: e.target.value }))}
                              placeholder="Leave empty for auto-generated footer"
                            />
                          </Grid>
                          
                          <Grid item xs={12} sm={6}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={embedData.showFooterInstructions}
                                  onChange={(e) => setEmbedData(prev => ({ ...prev, showFooterInstructions: e.target.checked }))}
                                />
                              }
                              label="Show Instructions in Footer"
                            />
                          </Grid>
                        </>
                      )}

                      {/* Author Section */}
                      <Grid item xs={12} sm={4}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showAuthor}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showAuthor: e.target.checked }))}
                            />
                          }
                          label="Show Author"
                        />
                      </Grid>

                      {embedData.showAuthor && (
                        <>
                          <Grid item xs={12} sm={4}>
                            <TextField
                              fullWidth
                              label="Custom Author Text"
                              value={embedData.customAuthor}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, customAuthor: e.target.value }))}
                              placeholder="Server Name Role Selection"
                            />
                          </Grid>
                          
                          <Grid item xs={12} sm={4}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={embedData.showAuthorIcon}
                                  onChange={(e) => setEmbedData(prev => ({ ...prev, showAuthorIcon: e.target.checked }))}
                                />
                              }
                              label="Show Author Icon"
                            />
                          </Grid>
                        </>
                      )}

                      {/* Timestamp */}
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={embedData.showTimestamp}
                              onChange={(e) => setEmbedData(prev => ({ ...prev, showTimestamp: e.target.checked }))}
                            />
                          }
                          label="Show Timestamp"
                        />
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>
              
              {/* Channel Selection */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  📍 Channel
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Channel *</InputLabel>
                  <Select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    label="Channel *"
                  >
                    {channels.map(channel => (
                      <MenuItem key={channel.id} value={channel.id}>
                        # {channel.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Buttons Section */}
              <Grid item xs={12}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} mt={2}>
                  <Typography variant="h6">
                    🎯 Buttons ({buttons.length}/25)
                  </Typography>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addButton}
                    disabled={buttons.length >= 25}
                    variant="outlined"
                  >
                    Add Button
                  </Button>
                </Box>
                
                {buttons.map((button, index) => (
                  <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="subtitle1">
                          Button {index + 1}
                        </Typography>
                        <IconButton
                          color="error"
                          onClick={() => removeButton(index)}
                          disabled={buttons.length === 1}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={2}>
                          <TextField
                            fullWidth
                            label="Emoji"
                            value={button.emoji}
                            onChange={(e) => updateButton(index, 'emoji', e.target.value)}
                            placeholder="🎯"
                          />
                        </Grid>
                        
                        <Grid item xs={12} sm={2}>
                          <TextField
                            fullWidth
                            label="Label"
                            value={button.label}
                            onChange={(e) => updateButton(index, 'label', e.target.value)}
                            placeholder="Role Name"
                          />
                        </Grid>
                        
                        <Grid item xs={12} sm={3}>
                          <TextField
                            fullWidth
                            label="Custom Button Text"
                            value={button.customLabel}
                            onChange={(e) => updateButtonCustomLabel(index, e.target.value)}
                            placeholder="Leave empty to use label"
                            helperText="Override button display text"
                          />
                        </Grid>
                        
                        <Grid item xs={12} sm={3}>
                          <FormControl fullWidth error={buttons.filter(b => b.roleId === button.roleId).length > 1}>
                            <InputLabel>Role *</InputLabel>
                            <Select
                              value={button.roleId}
                              onChange={(e) => updateButton(index, 'roleId', e.target.value)}
                              label="Role *"
                            >
                              {roles.map(role => {
                                const isUsed = buttons.some((b, i) => b.roleId === role.id && i !== index);
                                return (
                                  <MenuItem 
                                    key={role.id} 
                                    value={role.id}
                                    disabled={isUsed}
                                  >
                                    <Box display="flex" alignItems="center" gap={1}>
                                      <Box
                                        sx={{
                                          width: 12,
                                          height: 12,
                                          borderRadius: '50%',
                                          backgroundColor: role.color || '#99aab5'
                                        }}
                                      />
                                      {role.name} {isUsed && '(Already used)'}
                                    </Box>
                                  </MenuItem>
                                );
                              })}
                            </Select>
                            {buttons.filter(b => b.roleId === button.roleId).length > 1 && (
                              <Typography variant="caption" color="error">
                                This role is already assigned to another button
                              </Typography>
                            )}
                          </FormControl>
                        </Grid>
                        
                        <Grid item xs={12} sm={2}>
                          <FormControl fullWidth>
                            <InputLabel>Style</InputLabel>
                            <Select
                              value={button.style}
                              onChange={(e) => updateButton(index, 'style', e.target.value)}
                              label="Style"
                            >
                              {buttonStyles.map(style => (
                                <MenuItem key={style.value} value={style.value}>
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Box
                                      sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: 1,
                                        backgroundColor: style.color
                                      }}
                                    />
                                    {style.label}
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setEditDialog({ open: false, setup: null });
              setEditingSetup(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={updateButtonRoleSetup}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
            >
              {loading ? 'Updating...' : 'Update & Redeploy'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Redeploy Dialog */}
        <Dialog
          open={redeployDialog.open}
          onClose={() => setRedeployDialog({ open: false, setup: null })}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Redeploy Button Role Setup</DialogTitle>
          <DialogContent>
            {redeployDialog.setup && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  {redeployDialog.setup.embedData.title}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Select a channel to redeploy this button role setup to:
                </Typography>
                
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Channel</InputLabel>
                  <Select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    label="Channel"
                  >
                    {channels.map(channel => (
                      <MenuItem key={channel.id} value={channel.id}>
                        # {channel.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <Alert severity="info" sx={{ mt: 2 }}>
                  This will send the button role embed to the selected channel with all current settings.
                </Alert>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRedeployDialog({ open: false, setup: null })}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => redeployToChannel(redeployDialog.setup, selectedChannel)}
              disabled={loading || !selectedChannel}
              startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
            >
              {loading ? 'Deploying...' : 'Redeploy'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog
          open={previewDialog.open}
          onClose={() => setPreviewDialog({ open: false, setup: null })}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Button Role Preview</DialogTitle>
          <DialogContent>
            {previewDialog.setup && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  {previewDialog.setup.embedData.title}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {previewDialog.setup.embedData.description}
                </Typography>
                
                <Box display="flex" gap={1} flexWrap="wrap" mt={2}>
                  {previewDialog.setup.buttons.map((button, index) => {
                    const style = buttonStyles.find(s => s.value === button.style);
                    return (
                      <Button
                        key={index}
                        variant="contained"
                        sx={{
                          backgroundColor: style?.color || '#5865f2',
                          color: 'white'
                        }}
                        startIcon={<span>{button.emoji}</span>}
                        disabled
                      >
                        {button.customLabel || button.label}
                      </Button>
                    );
                  })}
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewDialog({ open: false, setup: null })}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Stats Dialog */}
        <Dialog
          open={statsDialog.open}
          onClose={() => setStatsDialog({ open: false, setup: null })}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Button Role Statistics</DialogTitle>
          <DialogContent>
            {statsDialog.setup && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  {statsDialog.setup.embedData.title}
                </Typography>
                
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Total Usage
                        </Typography>
                        <Typography variant="h4">
                          {getSetupStats(statsDialog.setup)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Buttons
                        </Typography>
                        <Typography variant="h4">
                          {statsDialog.setup.buttons.length}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
                
                <Typography variant="h6" gutterBottom>
                  Button Performance
                </Typography>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Button</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Added</TableCell>
                        <TableCell>Removed</TableCell>
                        <TableCell>Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {statsDialog.setup.buttons.map((button, index) => {
                        const stats = statsDialog.setup.usageStats[button.roleId] || { added: 0, removed: 0 };
                        const role = getRoleFromId(button.roleId);
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                <span>{button.emoji}</span>
                                {button.customLabel || button.label}
                              </Box>
                            </TableCell>
                            <TableCell>{role?.name || 'Unknown'}</TableCell>
                            <TableCell>
                              <Chip label={stats.added} size="small" color="success" />
                            </TableCell>
                            <TableCell>
                              <Chip label={stats.removed} size="small" color="warning" />
                            </TableCell>
                            <TableCell>
                              <Chip label={stats.added + stats.removed} size="small" color="primary" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStatsDialog({ open: false, setup: null })}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ButtonRolePanel;
