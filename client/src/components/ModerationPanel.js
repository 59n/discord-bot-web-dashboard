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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Slider
} from '@mui/material';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  Block as BlockIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon,
  AutoMode as AutoModeIcon,
  Shield as ShieldIcon,
  Gavel as GavelIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const ModerationPanel = ({ socket, user }) => {
  const [tabValue, setTabValue] = useState(0);
  const [tempConfig, setTempConfig] = useState({});
  const [moderationData, setModerationData] = useState({
    warnings: {},
    punishments: {},
    logs: [],
    stats: {},
    config: {}
  });
  
  const [newWarning, setNewWarning] = useState({
    userId: '',
    reason: ''
  });
  
  const [newPunishment, setNewPunishment] = useState({
    userId: '',
    type: 'mute',
    duration: 300000, // 5 minutes
    reason: ''
  });

  const [userSearchDialog, setUserSearchDialog] = useState({ open: false, type: null });
  const [configDialog, setConfigDialog] = useState({ open: false });

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

  useEffect(() => {
    loadModerationData();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('moderationAction', (action) => {
        toast.success(`Moderation action: ${action.type}`);
        loadModerationData();
      });

    socket.on('autoModAction', (action) => {
        toast(`Auto-mod: ${action.type} detected`, {
            icon: '🤖',
            style: {
                borderRadius: '10px',
                background: '#333',
                color: '#fff',
            },
        });
        loadModerationData();
    });
      return () => {
        socket.off('moderationAction');
        socket.off('autoModAction');
      };
    }
  }, [socket]);

  const loadModerationData = async () => {
    try {
      const data = await apiRequest('/moderation');
      setModerationData(data);
    } catch (error) {
      console.error('Failed to load moderation data:', error);
    }
  };

  const addWarning = async () => {
    if (!newWarning.userId || !newWarning.reason) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await apiRequest('/moderation/warn', {
        method: 'POST',
        body: JSON.stringify({
          guildId: '1160603423385866381', // Replace with dynamic guild ID
          ...newWarning
        })
      });
      
      setNewWarning({ userId: '', reason: '' });
      toast.success('Warning added successfully!');
      await loadModerationData();
    } catch (error) {
      toast.error(error.message || 'Failed to add warning');
    }
  };

  const addPunishment = async () => {
    if (!newPunishment.userId || !newPunishment.reason) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await apiRequest('/moderation/punish', {
        method: 'POST',
        body: JSON.stringify({
          guildId: '1160603423385866381', // Replace with dynamic guild ID
          ...newPunishment
        })
      });
      
      setNewPunishment({ userId: '', type: 'mute', duration: 300000, reason: '' });
      toast.success('Punishment applied successfully!');
      await loadModerationData();
    } catch (error) {
      toast.error(error.message || 'Failed to apply punishment');
    }
  };

  const removeWarning = async (warningId) => {
    try {
      await apiRequest(`/moderation/warn/${warningId}`, {
        method: 'DELETE'
      });
      
      toast.success('Warning removed successfully!');
      await loadModerationData();
    } catch (error) {
      toast.error('Failed to remove warning');
    }
  };

  const removePunishment = async (punishmentId) => {
    try {
      await apiRequest(`/moderation/punish/${punishmentId}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: 'Manual removal by moderator' })
      });
      
      toast.success('Punishment removed successfully!');
      await loadModerationData();
    } catch (error) {
      toast.error('Failed to remove punishment');
    }
  };

  const updateConfig = async (newConfig) => {
    try {
      await apiRequest('/moderation/config', {
        method: 'POST',
        body: JSON.stringify(newConfig)
      });
      
      toast.success('Configuration updated successfully!');
      await loadModerationData();
      setConfigDialog({ open: false });
    } catch (error) {
      toast.error('Failed to update configuration');
    }
  };

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            <ShieldIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Advanced Moderation System
          </Typography>
          
          <Box display="flex" alignItems="center" gap={1}>
            <Chip 
              label={`${moderationData.stats.activeWarnings || 0} Active Warnings`} 
              color="warning"
              size="small"
            />
            <Chip 
              label={`${moderationData.stats.activePunishments || 0} Active Punishments`} 
              color="error"
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
          <Tab label="Quick Actions" />
          <Tab label={`Warnings (${Object.values(moderationData.warnings || {}).flat().filter(w => w.active).length})`} />
          <Tab label={`Punishments (${Object.values(moderationData.punishments || {}).flat().filter(p => p.active).length})`} />
          <Tab label={`Logs (${moderationData.logs.length})`} />
          <Tab label="Auto-Moderation" />
        </Tabs>

        <Box sx={{ mt: 3 }}>
          {/* Quick Actions Tab */}
          {tabValue === 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Grid container spacing={3}>
                {/* Statistics Cards */}
                <Grid item xs={12}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={3}>
                      <Card sx={{ bgcolor: 'warning.dark', color: 'white' }}>
                        <CardContent>
                          <Box display="flex" alignItems="center">
                            <WarningIcon sx={{ mr: 2, fontSize: 40 }} />
                            <Box>
                              <Typography variant="h4">{moderationData.stats.totalWarnings || 0}</Typography>
                              <Typography variant="body2">Total Warnings</Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Card sx={{ bgcolor: 'error.dark', color: 'white' }}>
                        <CardContent>
                          <Box display="flex" alignItems="center">
                            <BlockIcon sx={{ mr: 2, fontSize: 40 }} />
                            <Box>
                              <Typography variant="h4">{moderationData.stats.totalPunishments || 0}</Typography>
                              <Typography variant="body2">Total Punishments</Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Card sx={{ bgcolor: 'info.dark', color: 'white' }}>
                        <CardContent>
                          <Box display="flex" alignItems="center">
                            <AutoModeIcon sx={{ mr: 2, fontSize: 40 }} />
                            <Box>
                              <Typography variant="h4">{moderationData.logs.filter(l => l.moderatorId === 'system').length}</Typography>
                              <Typography variant="body2">Auto-Mod Actions</Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Card sx={{ bgcolor: 'success.dark', color: 'white' }}>
                        <CardContent>
                          <Box display="flex" alignItems="center">
                            <GavelIcon sx={{ mr: 2, fontSize: 40 }} />
                            <Box>
                              <Typography variant="h4">{moderationData.stats.totalActions || 0}</Typography>
                              <Typography variant="body2">Total Actions</Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Grid>

                {/* Quick Warning */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        <WarningIcon sx={{ mr: 1 }} />
                        Quick Warning
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="User ID"
                            value={newWarning.userId}
                            onChange={(e) => setNewWarning(prev => ({ ...prev, userId: e.target.value }))}
                            placeholder="123456789012345678"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Reason"
                            value={newWarning.reason}
                            onChange={(e) => setNewWarning(prev => ({ ...prev, reason: e.target.value }))}
                            placeholder="Reason for warning..."
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Button
                            fullWidth
                            variant="contained"
                            color="warning"
                            onClick={addWarning}
                            disabled={!newWarning.userId || !newWarning.reason}
                          >
                            Add Warning
                          </Button>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Quick Punishment */}
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        <BlockIcon sx={{ mr: 1 }} />
                        Quick Punishment
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="User ID"
                            value={newPunishment.userId}
                            onChange={(e) => setNewPunishment(prev => ({ ...prev, userId: e.target.value }))}
                            placeholder="123456789012345678"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth>
                            <InputLabel>Type</InputLabel>
                            <Select
                              value={newPunishment.type}
                              onChange={(e) => setNewPunishment(prev => ({ ...prev, type: e.target.value }))}
                            >
                              <MenuItem value="mute">Mute</MenuItem>
                              <MenuItem value="kick">Kick</MenuItem>
                              <MenuItem value="ban">Ban</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Duration (minutes)"
                            value={Math.floor(newPunishment.duration / 60000)}
                            onChange={(e) => setNewPunishment(prev => ({ 
                              ...prev, 
                              duration: parseInt(e.target.value) * 60000 
                            }))}
                            disabled={newPunishment.type === 'kick'}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Reason"
                            value={newPunishment.reason}
                            onChange={(e) => setNewPunishment(prev => ({ ...prev, reason: e.target.value }))}
                            placeholder="Reason for punishment..."
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Button
                            fullWidth
                            variant="contained"
                            color="error"
                            onClick={addPunishment}
                            disabled={!newPunishment.userId || !newPunishment.reason}
                          >
                            Apply {newPunishment.type.charAt(0).toUpperCase() + newPunishment.type.slice(1)}
                          </Button>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </motion.div>
          )}

          {/* Warnings Tab */}
          {tabValue === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Typography variant="h6" gutterBottom>
                Active Warnings
              </Typography>
              
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User ID</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell>Moderator</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.values(moderationData.warnings || {}).flat()
                      .filter(warning => warning.active)
                      .map((warning) => (
                        <TableRow key={warning.id}>
                          <TableCell>{warning.userId}</TableCell>
                          <TableCell>{warning.reason}</TableCell>
                          <TableCell>{warning.moderatorId}</TableCell>
                          <TableCell>{formatTime(warning.timestamp)}</TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeWarning(warning.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </motion.div>
          )}

          {/* Punishments Tab */}
          {tabValue === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Typography variant="h6" gutterBottom>
                Active Punishments
              </Typography>
              
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User ID</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell>Moderator</TableCell>
                      <TableCell>Expires</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.values(moderationData.punishments || {}).flat()
                      .filter(punishment => punishment.active)
                      .map((punishment) => (
                        <TableRow key={punishment.id}>
                          <TableCell>{punishment.userId}</TableCell>
                          <TableCell>
                            <Chip 
                              label={punishment.type} 
                              color={punishment.type === 'ban' ? 'error' : punishment.type === 'mute' ? 'warning' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {punishment.duration ? formatDuration(punishment.duration) : 'Permanent'}
                          </TableCell>
                          <TableCell>{punishment.reason}</TableCell>
                          <TableCell>{punishment.moderatorId}</TableCell>
                          <TableCell>
                            {punishment.expiresAt ? formatTime(punishment.expiresAt) : 'Never'}
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => removePunishment(punishment.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </motion.div>
          )}

          {/* Logs Tab */}
          {tabValue === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Typography variant="h6" gutterBottom>
                Moderation Logs
              </Typography>
              
              <List>
                {moderationData.logs.slice(0, 50).map((log, index) => (
                  <ListItem key={index} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, mb: 1 }}>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip 
                            label={log.action} 
                            size="small" 
                            color={log.moderatorId === 'system' ? 'info' : 'primary'}
                          />
                          <Typography variant="body2">
                            Target: {log.targetId} | Moderator: {log.moderatorId}
                          </Typography>
                        </Box>
                      }
                      secondary={`${log.reason || 'No reason provided'} | ${formatTime(log.timestamp)}`}
                    />
                  </ListItem>
                ))}
              </List>
            </motion.div>
          )}

          {/* Auto-Moderation Tab */}
          {tabValue === 4 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6">
                  Auto-Moderation Configuration
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<SettingsIcon />}
                  onClick={() => setConfigDialog({ open: true })}
                >
                  Configure
                </Button>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Spam Protection</Typography>
                      <FormControlLabel
                        control={
                          <Switch 
                            checked={moderationData.config?.spamProtection?.enabled || false}
                            disabled
                          />
                        }
                        label="Enabled"
                      />
                      <Typography variant="body2" color="textSecondary">
                        Max {moderationData.config?.spamProtection?.maxMessages || 5} messages in {(moderationData.config?.spamProtection?.timeWindow || 5000) / 1000}s
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Profanity Filter</Typography>
                      <FormControlLabel
                        control={
                          <Switch 
                            checked={moderationData.config?.profanityFilter?.enabled || false}
                            disabled
                          />
                        }
                        label="Enabled"
                      />
                      <Typography variant="body2" color="textSecondary">
                        {moderationData.config?.profanityFilter?.words?.length || 0} blocked words
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Link Protection</Typography>
                      <FormControlLabel
                        control={
                          <Switch 
                            checked={moderationData.config?.linkProtection?.enabled || false}
                            disabled
                          />
                        }
                        label="Enabled"
                      />
                      <Typography variant="body2" color="textSecondary">
                        {moderationData.config?.linkProtection?.whitelist?.length || 0} whitelisted domains
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Anti-Raid</Typography>
                      <FormControlLabel
                        control={
                          <Switch 
                            checked={moderationData.config?.antiRaid?.enabled || false}
                            disabled
                          />
                        }
                        label="Enabled"
                      />
                      <Typography variant="body2" color="textSecondary">
                        Max {moderationData.config?.antiRaid?.maxJoins || 10} joins in {(moderationData.config?.antiRaid?.timeWindow || 60000) / 1000}s
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </motion.div>
          )}
        </Box>
      </CardContent>

{/* Configuration Dialog */}
<Dialog
  open={configDialog.open}
  onClose={() => setConfigDialog({ open: false })}
  maxWidth="lg"
  fullWidth
>
  <DialogTitle>
    <Box display="flex" alignItems="center">
      <SettingsIcon sx={{ mr: 1 }} />
      Auto-Moderation Configuration
    </Box>
  </DialogTitle>
  <DialogContent>
    <Alert severity="info" sx={{ mb: 3 }}>
      Configure automatic moderation settings. Changes take effect immediately.
    </Alert>
    
    <Grid container spacing={3}>
      {/* Spam Protection */}
      <Grid item xs={12}>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">🚫 Spam Protection</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={tempConfig.spamProtection?.enabled ?? moderationData.config?.spamProtection?.enabled ?? true}
                      onChange={(e) => setTempConfig(prev => ({
                        ...prev,
                        spamProtection: {
                          ...prev.spamProtection,
                          enabled: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Enable Spam Protection"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max Messages"
                  value={tempConfig.spamProtection?.maxMessages ?? moderationData.config?.spamProtection?.maxMessages ?? 5}
                  onChange={(e) => setTempConfig(prev => ({
                    ...prev,
                    spamProtection: {
                      ...prev.spamProtection,
                      maxMessages: parseInt(e.target.value)
                    }
                  }))}
                  inputProps={{ min: 2, max: 20 }}
                  helperText="Maximum messages allowed"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Time Window (seconds)"
                  value={(tempConfig.spamProtection?.timeWindow ?? moderationData.config?.spamProtection?.timeWindow ?? 5000) / 1000}
                  onChange={(e) => setTempConfig(prev => ({
                    ...prev,
                    spamProtection: {
                      ...prev.spamProtection,
                      timeWindow: parseInt(e.target.value) * 1000
                    }
                  }))}
                  inputProps={{ min: 1, max: 60 }}
                  helperText="Time window for message counting"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Punishment</InputLabel>
                  <Select
                    value={tempConfig.spamProtection?.punishment ?? moderationData.config?.spamProtection?.punishment ?? 'mute'}
                    onChange={(e) => setTempConfig(prev => ({
                      ...prev,
                      spamProtection: {
                        ...prev.spamProtection,
                        punishment: e.target.value
                      }
                    }))}
                  >
                    <MenuItem value="warn">Warning</MenuItem>
                    <MenuItem value="mute">Mute</MenuItem>
                    <MenuItem value="kick">Kick</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Punishment Duration (minutes)"
                  value={(tempConfig.spamProtection?.duration ?? moderationData.config?.spamProtection?.duration ?? 300000) / 60000}
                  onChange={(e) => setTempConfig(prev => ({
                    ...prev,
                    spamProtection: {
                      ...prev.spamProtection,
                      duration: parseInt(e.target.value) * 60000
                    }
                  }))}
                  inputProps={{ min: 1, max: 1440 }}
                  helperText="Duration for mute punishment"
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Grid>

      {/* Profanity Filter */}
      <Grid item xs={12}>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">🤬 Profanity Filter</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={tempConfig.profanityFilter?.enabled ?? moderationData.config?.profanityFilter?.enabled ?? true}
                      onChange={(e) => setTempConfig(prev => ({
                        ...prev,
                        profanityFilter: {
                          ...prev.profanityFilter,
                          enabled: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Enable Profanity Filter"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Blocked Words (one per line)"
                  value={(tempConfig.profanityFilter?.words ?? moderationData.config?.profanityFilter?.words ?? []).join('\n')}
                  onChange={(e) => setTempConfig(prev => ({
                    ...prev,
                    profanityFilter: {
                      ...prev.profanityFilter,
                      words: e.target.value.split('\n').filter(word => word.trim())
                    }
                  }))}
                  placeholder="badword1&#10;badword2&#10;badword3"
                  helperText="Enter blocked words, one per line"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Punishment</InputLabel>
                  <Select
                    value={tempConfig.profanityFilter?.punishment ?? moderationData.config?.profanityFilter?.punishment ?? 'warn'}
                    onChange={(e) => setTempConfig(prev => ({
                      ...prev,
                      profanityFilter: {
                        ...prev.profanityFilter,
                        punishment: e.target.value
                      }
                    }))}
                  >
                    <MenuItem value="warn">Warning</MenuItem>
                    <MenuItem value="mute">Mute</MenuItem>
                    <MenuItem value="kick">Kick</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={tempConfig.profanityFilter?.deleteMessage ?? moderationData.config?.profanityFilter?.deleteMessage ?? true}
                      onChange={(e) => setTempConfig(prev => ({
                        ...prev,
                        profanityFilter: {
                          ...prev.profanityFilter,
                          deleteMessage: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Delete Message"
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Grid>

      {/* Link Protection */}
      <Grid item xs={12}>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">🔗 Link Protection</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={tempConfig.linkProtection?.enabled ?? moderationData.config?.linkProtection?.enabled ?? true}
                      onChange={(e) => setTempConfig(prev => ({
                        ...prev,
                        linkProtection: {
                          ...prev.linkProtection,
                          enabled: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Enable Link Protection"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Whitelisted Domains (one per line)"
                  value={(tempConfig.linkProtection?.whitelist ?? moderationData.config?.linkProtection?.whitelist ?? []).join('\n')}
                  onChange={(e) => setTempConfig(prev => ({
                    ...prev,
                    linkProtection: {
                      ...prev.linkProtection,
                      whitelist: e.target.value.split('\n').filter(domain => domain.trim())
                    }
                  }))}
                  placeholder="discord.gg&#10;youtube.com&#10;github.com"
                  helperText="Enter allowed domains, one per line"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Punishment</InputLabel>
                  <Select
                    value={tempConfig.linkProtection?.punishment ?? moderationData.config?.linkProtection?.punishment ?? 'warn'}
                    onChange={(e) => setTempConfig(prev => ({
                      ...prev,
                      linkProtection: {
                        ...prev.linkProtection,
                        punishment: e.target.value
                      }
                    }))}
                  >
                    <MenuItem value="warn">Warning</MenuItem>
                    <MenuItem value="mute">Mute</MenuItem>
                    <MenuItem value="kick">Kick</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={tempConfig.linkProtection?.deleteMessage ?? moderationData.config?.linkProtection?.deleteMessage ?? true}
                      onChange={(e) => setTempConfig(prev => ({
                        ...prev,
                        linkProtection: {
                          ...prev.linkProtection,
                          deleteMessage: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Delete Message"
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Grid>

      {/* Anti-Raid */}
      <Grid item xs={12}>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">🛡️ Anti-Raid Protection</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={tempConfig.antiRaid?.enabled ?? moderationData.config?.antiRaid?.enabled ?? true}
                      onChange={(e) => setTempConfig(prev => ({
                        ...prev,
                        antiRaid: {
                          ...prev.antiRaid,
                          enabled: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Enable Anti-Raid Protection"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max Joins"
                  value={tempConfig.antiRaid?.maxJoins ?? moderationData.config?.antiRaid?.maxJoins ?? 10}
                  onChange={(e) => setTempConfig(prev => ({
                    ...prev,
                    antiRaid: {
                      ...prev.antiRaid,
                      maxJoins: parseInt(e.target.value)
                    }
                  }))}
                  inputProps={{ min: 3, max: 50 }}
                  helperText="Maximum joins allowed"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Time Window (seconds)"
                  value={(tempConfig.antiRaid?.timeWindow ?? moderationData.config?.antiRaid?.timeWindow ?? 60000) / 1000}
                  onChange={(e) => setTempConfig(prev => ({
                    ...prev,
                    antiRaid: {
                      ...prev.antiRaid,
                      timeWindow: parseInt(e.target.value) * 1000
                    }
                  }))}
                  inputProps={{ min: 10, max: 300 }}
                  helperText="Time window for join counting"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Action</InputLabel>
                  <Select
                    value={tempConfig.antiRaid?.action ?? moderationData.config?.antiRaid?.action ?? 'lockdown'}
                    onChange={(e) => setTempConfig(prev => ({
                      ...prev,
                      antiRaid: {
                        ...prev.antiRaid,
                        action: e.target.value
                      }
                    }))}
                  >
                    <MenuItem value="lockdown">Enable Slowmode</MenuItem>
                    <MenuItem value="alert">Alert Only</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Grid>

      {/* Caps Protection */}
      <Grid item xs={12}>
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">📢 Caps Protection</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={tempConfig.capsProtection?.enabled ?? moderationData.config?.capsProtection?.enabled ?? true}
                      onChange={(e) => setTempConfig(prev => ({
                        ...prev,
                        capsProtection: {
                          ...prev.capsProtection,
                          enabled: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Enable Caps Protection"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max Caps Percentage"
                  value={tempConfig.capsProtection?.maxCapsPercentage ?? moderationData.config?.capsProtection?.maxCapsPercentage ?? 70}
                  onChange={(e) => setTempConfig(prev => ({
                    ...prev,
                    capsProtection: {
                      ...prev.capsProtection,
                      maxCapsPercentage: parseInt(e.target.value)
                    }
                  }))}
                  inputProps={{ min: 10, max: 100 }}
                  helperText="% of caps allowed"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Minimum Length"
                  value={tempConfig.capsProtection?.minLength ?? moderationData.config?.capsProtection?.minLength ?? 10}
                  onChange={(e) => setTempConfig(prev => ({
                    ...prev,
                    capsProtection: {
                      ...prev.capsProtection,
                      minLength: parseInt(e.target.value)
                    }
                  }))}
                  inputProps={{ min: 5, max: 100 }}
                  helperText="Min message length to check"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Punishment</InputLabel>
                  <Select
                    value={tempConfig.capsProtection?.punishment ?? moderationData.config?.capsProtection?.punishment ?? 'warn'}
                    onChange={(e) => setTempConfig(prev => ({
                      ...prev,
                      capsProtection: {
                        ...prev.capsProtection,
                        punishment: e.target.value
                      }
                    }))}
                  >
                    <MenuItem value="warn">Warning</MenuItem>
                    <MenuItem value="mute">Mute</MenuItem>
                    <MenuItem value="delete">Delete Only</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Grid>
    </Grid>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => {
      setConfigDialog({ open: false });
      setTempConfig({});
    }}>
      Cancel
    </Button>
    <Button 
      variant="contained" 
      onClick={() => {
        updateConfig(tempConfig);
        setTempConfig({});
      }}
    >
      Save Changes
    </Button>
  </DialogActions>
</Dialog>
    </Card>
  );
};

export default ModerationPanel;
