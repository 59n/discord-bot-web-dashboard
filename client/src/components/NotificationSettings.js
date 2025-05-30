import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  Box,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  Palette as PaletteIcon,
  Filter as FilterIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

const NotificationSettings = ({ open, onClose, notification, type, onSave }) => {
  const [settings, setSettings] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (notification) {
      setSettings(notification);
    } else {
      // Default settings based on type
      switch (type) {
        case 'rss':
          setSettings({
            name: '',
            url: '',
            channelId: '',
            enabled: true,
            embed: {
              enabled: true,
              color: '#5865f2',
              includeImage: true,
              includeDescription: true
            },
            filters: {
              keywords: [],
              excludeKeywords: [],
              maxAge: 24
            }
          });
          break;
        case 'social':
          setSettings({
            platform: 'youtube',
            username: '',
            channelId: '',
            enabled: true,
            notifications: {
              newPosts: true,
              liveStreams: true,
              newVideos: true
            },
            embed: {
              enabled: true,
              color: '#1DA1F2',
              includeMedia: true
            }
          });
          break;
        case 'scheduled':
          setSettings({
            name: '',
            content: '',
            channelId: '',
            enabled: true,
            schedule: {
              type: 'daily',
              time: '09:00',
              timezone: 'UTC',
              dayOfWeek: 1,
              dayOfMonth: 1
            },
            embed: {
              enabled: false,
              title: '',
              color: '#5865f2',
              image: ''
            }
          });
          break;
        default:
          setSettings({});
      }
    }
  }, [notification, type]);

  const validateSettings = () => {
    const newErrors = {};

    if (type === 'rss') {
      if (!settings.name) newErrors.name = 'Name is required';
      if (!settings.url) newErrors.url = 'URL is required';
      if (!settings.channelId) newErrors.channelId = 'Channel is required';
    } else if (type === 'social') {
      if (!settings.username) newErrors.username = 'Username is required';
      if (!settings.channelId) newErrors.channelId = 'Channel is required';
    } else if (type === 'scheduled') {
      if (!settings.name) newErrors.name = 'Name is required';
      if (!settings.content) newErrors.content = 'Content is required';
      if (!settings.channelId) newErrors.channelId = 'Channel is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateSettings()) {
      onSave(settings);
      onClose();
    }
  };

  const updateSetting = (path, value) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  const addKeyword = (type, keyword) => {
    if (keyword.trim()) {
      const currentKeywords = settings.filters?.[type] || [];
      updateSetting(`filters.${type}`, [...currentKeywords, keyword.trim()]);
    }
  };

  const removeKeyword = (type, index) => {
    const currentKeywords = settings.filters?.[type] || [];
    const newKeywords = currentKeywords.filter((_, i) => i !== index);
    updateSetting(`filters.${type}`, newKeywords);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <SettingsIcon sx={{ mr: 1 }} />
          {notification ? 'Edit' : 'Create'} {type === 'rss' ? 'RSS Feed' : type === 'social' ? 'Social Media Account' : 'Scheduled Message'}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={3}>
          {/* Basic Settings */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Basic Settings</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {type !== 'social' && (
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Name"
                        value={settings.name || ''}
                        onChange={(e) => updateSetting('name', e.target.value)}
                        error={!!errors.name}
                        helperText={errors.name}
                      />
                    </Grid>
                  )}
                  
                  {type === 'rss' && (
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="RSS URL"
                        value={settings.url || ''}
                        onChange={(e) => updateSetting('url', e.target.value)}
                        error={!!errors.url}
                        helperText={errors.url}
                      />
                    </Grid>
                  )}
                  
                  {type === 'social' && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Platform</InputLabel>
                          <Select
                            value={settings.platform || 'youtube'}
                            onChange={(e) => updateSetting('platform', e.target.value)}
                          >
                            <MenuItem value="youtube">YouTube</MenuItem>
                            <MenuItem value="twitch">Twitch</MenuItem>
                            <MenuItem value="twitter">Twitter</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Username/Channel ID"
                          value={settings.username || ''}
                          onChange={(e) => updateSetting('username', e.target.value)}
                          error={!!errors.username}
                          helperText={errors.username}
                        />
                      </Grid>
                    </>
                  )}
                  
                  {type === 'scheduled' && (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Message Content"
                        value={settings.content || ''}
                        onChange={(e) => updateSetting('content', e.target.value)}
                        error={!!errors.content}
                        helperText={errors.content}
                        inputProps={{ maxLength: 2000 }}
                      />
                    </Grid>
                  )}
                  
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.enabled || false}
                          onChange={(e) => updateSetting('enabled', e.target.checked)}
                        />
                      }
                      label="Enabled"
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Embed Settings */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center">
                  <PaletteIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Embed Settings</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.embed?.enabled || false}
                          onChange={(e) => updateSetting('embed.enabled', e.target.checked)}
                        />
                      }
                      label="Use Rich Embeds"
                    />
                  </Grid>
                  
                  {settings.embed?.enabled && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="color"
                          label="Embed Color"
                          value={settings.embed?.color || '#5865f2'}
                          onChange={(e) => updateSetting('embed.color', e.target.value)}
                        />
                      </Grid>
                      
                      {type === 'rss' && (
                        <>
                          <Grid item xs={12} sm={6}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={settings.embed?.includeImage || false}
                                  onChange={(e) => updateSetting('embed.includeImage', e.target.checked)}
                                />
                              }
                              label="Include Images"
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={settings.embed?.includeDescription || false}
                                  onChange={(e) => updateSetting('embed.includeDescription', e.target.checked)}
                                />
                              }
                              label="Include Description"
                            />
                          </Grid>
                        </>
                      )}
                      
                      {type === 'scheduled' && (
                        <>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="Embed Title"
                              value={settings.embed?.title || ''}
                              onChange={(e) => updateSetting('embed.title', e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="Embed Image URL"
                              value={settings.embed?.image || ''}
                              onChange={(e) => updateSetting('embed.image', e.target.value)}
                            />
                          </Grid>
                        </>
                      )}
                    </>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Filters (RSS only) */}
          {type === 'rss' && (
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center">
                    <FilterIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Content Filters</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Max Age (hours)"
                        value={settings.filters?.maxAge || 24}
                        onChange={(e) => updateSetting('filters.maxAge', parseInt(e.target.value))}
                        inputProps={{ min: 1, max: 168 }}
                        helperText="Only show items newer than this"
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Include Keywords
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                        {(settings.filters?.keywords || []).map((keyword, index) => (
                          <Chip
                            key={index}
                            label={keyword}
                            onDelete={() => removeKeyword('keywords', index)}
                            color="primary"
                            size="small"
                          />
                        ))}
                      </Box>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Add keyword and press Enter"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addKeyword('keywords', e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>
                        Exclude Keywords
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                        {(settings.filters?.excludeKeywords || []).map((keyword, index) => (
                          <Chip
                            key={index}
                            label={keyword}
                            onDelete={() => removeKeyword('excludeKeywords', index)}
                            color="error"
                            size="small"
                          />
                        ))}
                      </Box>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Add keyword to exclude and press Enter"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addKeyword('excludeKeywords', e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
          )}

          {/* Schedule Settings (Scheduled Messages only) */}
          {type === 'scheduled' && (
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center">
                    <ScheduleIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Schedule Settings</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <InputLabel>Schedule Type</InputLabel>
                        <Select
                          value={settings.schedule?.type || 'daily'}
                          onChange={(e) => updateSetting('schedule.type', e.target.value)}
                        >
                          <MenuItem value="daily">Daily</MenuItem>
                          <MenuItem value="weekly">Weekly</MenuItem>
                          <MenuItem value="monthly">Monthly</MenuItem>
                          <MenuItem value="once">Once</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        type="time"
                        label="Time"
                        value={settings.schedule?.time || '09:00'}
                        onChange={(e) => updateSetting('schedule.time', e.target.value)}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <InputLabel>Timezone</InputLabel>
                        <Select
                          value={settings.schedule?.timezone || 'UTC'}
                          onChange={(e) => updateSetting('schedule.timezone', e.target.value)}
                        >
                          <MenuItem value="UTC">UTC</MenuItem>
                          <MenuItem value="America/New_York">Eastern Time</MenuItem>
                          <MenuItem value="America/Chicago">Central Time</MenuItem>
                          <MenuItem value="America/Denver">Mountain Time</MenuItem>
                          <MenuItem value="America/Los_Angeles">Pacific Time</MenuItem>
                          <MenuItem value="Europe/London">London</MenuItem>
                          <MenuItem value="Europe/Paris">Paris</MenuItem>
                          <MenuItem value="Asia/Tokyo">Tokyo</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    {settings.schedule?.type === 'weekly' && (
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Day of Week</InputLabel>
                          <Select
                            value={settings.schedule?.dayOfWeek || 1}
                            onChange={(e) => updateSetting('schedule.dayOfWeek', e.target.value)}
                          >
                            <MenuItem value={0}>Sunday</MenuItem>
                            <MenuItem value={1}>Monday</MenuItem>
                            <MenuItem value={2}>Tuesday</MenuItem>
                            <MenuItem value={3}>Wednesday</MenuItem>
                            <MenuItem value={4}>Thursday</MenuItem>
                            <MenuItem value={5}>Friday</MenuItem>
                            <MenuItem value={6}>Saturday</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    )}
                    
                    {settings.schedule?.type === 'monthly' && (
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Day of Month"
                          value={settings.schedule?.dayOfMonth || 1}
                          onChange={(e) => updateSetting('schedule.dayOfMonth', parseInt(e.target.value))}
                          inputProps={{ min: 1, max: 31 }}
                        />
                      </Grid>
                    )}
                    
                    {settings.schedule?.type === 'once' && (
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="date"
                          label="Date"
                          value={settings.schedule?.date || ''}
                          onChange={(e) => updateSetting('schedule.date', e.target.value)}
                        />
                      </Grid>
                    )}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
          )}

          {/* Social Media Notifications */}
          {type === 'social' && (
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Notification Types</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.notifications?.newPosts || false}
                            onChange={(e) => updateSetting('notifications.newPosts', e.target.checked)}
                          />
                        }
                        label="New Posts/Videos"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.notifications?.liveStreams || false}
                            onChange={(e) => updateSetting('notifications.liveStreams', e.target.checked)}
                          />
                        }
                        label="Live Streams"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.notifications?.newVideos || false}
                            onChange={(e) => updateSetting('notifications.newVideos', e.target.checked)}
                          />
                        }
                        label="New Videos"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
          )}
        </Grid>

        {Object.keys(errors).length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Please fix the errors above before saving.
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave}>
          {notification ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NotificationSettings;
