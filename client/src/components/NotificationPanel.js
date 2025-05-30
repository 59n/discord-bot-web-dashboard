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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  RssFeed as RssIcon,
  Schedule as ScheduleIcon,
  Webhook as WebhookIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Science as TestIcon,
  ExpandMore as ExpandMoreIcon,
  YouTube as YouTubeIcon,
  Twitter as TwitterIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const NotificationPanel = ({ socket, user }) => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userTimezone, setUserTimezone] = useState('UTC');
  const [notificationData, setNotificationData] = useState({
    rssFeeds: {},
    socialMedia: {},
    scheduledMessages: {},
    webhooks: {},
    stats: {}
  });

  const [newRSSFeed, setNewRSSFeed] = useState({
    name: '',
    url: '',
    channelId: '',
    embed: { enabled: true, color: '#5865f2', includeImage: true, includeDescription: true },
    filters: { keywords: [], excludeKeywords: [], maxAge: 24 }
  });

  const [newSocialAccount, setNewSocialAccount] = useState({
    platform: 'youtube',
    username: '',
    channelId: '',
    notifications: { newPosts: true, liveStreams: true, newVideos: true },
    embed: { enabled: true, color: '#1DA1F2', includeMedia: true }
  });

  const [newWebhook, setNewWebhook] = useState({
    name: '',
    channelId: '',
    secret: '',
    embed: { enabled: true, color: '#5865f2' }
  });

  const [guilds, setGuilds] = useState([]);
  const [channels, setChannels] = useState([]);
  const [testDialog, setTestDialog] = useState({ open: false, url: '', result: null });

  // Helper function to get current time in 24h format
  const getCurrentTime24h = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  // Helper function to format time display
  const formatTimeDisplay = (time24h, timezone) => {
    try {
      return `${time24h} (${timezone.replace('_', ' ')})`;
    } catch (error) {
      return `${time24h} (${timezone})`;
    }
  };

  // Helper function to get timezone display name
  const getTimezoneDisplayName = (timezone) => {
    const timezoneNames = {
      'UTC': '🌐 UTC (Coordinated Universal Time)',
      'America/New_York': '🇺🇸 Eastern Time (New York)',
      'America/Chicago': '🇺🇸 Central Time (Chicago)',
      'America/Denver': '🇺🇸 Mountain Time (Denver)',
      'America/Los_Angeles': '🇺🇸 Pacific Time (Los Angeles)',
      'Europe/London': '🇬🇧 London (GMT/BST)',
      'Europe/Paris': '🇫🇷 Paris (CET/CEST)',
      'Europe/Berlin': '🇩🇪 Berlin (CET/CEST)',
      'Europe/Rome': '🇮🇹 Rome (CET/CEST)',
      'Europe/Madrid': '🇪🇸 Madrid (CET/CEST)',
      'Asia/Tokyo': '🇯🇵 Tokyo (JST)',
      'Asia/Shanghai': '🇨🇳 Shanghai (CST)',
      'Asia/Kolkata': '🇮🇳 India (IST)',
      'Australia/Sydney': '🇦🇺 Sydney (AEST/AEDT)'
    };
    
    return timezoneNames[timezone] || `🌍 ${timezone.replace('_', ' ')}`;
  };

  const [newScheduledMessage, setNewScheduledMessage] = useState({
    name: '',
    content: '',
    channelId: '',
    schedule: { 
      type: 'daily', 
      time: getCurrentTime24h(),
      timezone: 'UTC',
      date: new Date().toISOString().split('T')[0]
    },
    embed: null
  });

  // Detect user's timezone on component mount
  useEffect(() => {
    try {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setUserTimezone(detectedTimezone);
      
      // Update default timezone in new scheduled message
      setNewScheduledMessage(prev => ({
        ...prev,
        schedule: {
          ...prev.schedule,
          timezone: detectedTimezone
        }
      }));
      
      console.log(`🌍 Detected user timezone: ${detectedTimezone}`);
    } catch (error) {
      console.log('Could not detect timezone, using UTC');
    }
  }, []);

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
    loadNotificationData();
    loadGuilds();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('rssNotification', (data) => {
        toast.success(`RSS: ${data.feedName} - ${data.itemTitle}`);
        loadNotificationData();
      });

      socket.on('scheduledMessageSent', (data) => {
        toast.success(`Scheduled: ${data.messageName} sent`);
        loadNotificationData();
      });

      return () => {
        socket.off('rssNotification');
        socket.off('scheduledMessageSent');
      };
    }
  }, [socket]);

  const loadNotificationData = async () => {
    try {
      const data = await apiRequest('/notifications');
      setNotificationData(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const loadGuilds = async () => {
    try {
      const guildsData = await apiRequest('/guilds');
      setGuilds(guildsData);
      if (guildsData.length > 0) {
        setChannels(guildsData[0].channels || []);
      }
    } catch (error) {
      console.error('Failed to load guilds:', error);
    }
  };

  const createRSSFeed = async () => {
    if (!newRSSFeed.name || !newRSSFeed.url || !newRSSFeed.channelId) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await apiRequest('/notifications/rss', {
        method: 'POST',
        body: JSON.stringify(newRSSFeed)
      });
      
      setNewRSSFeed({
        name: '',
        url: '',
        channelId: '',
        embed: { enabled: true, color: '#5865f2', includeImage: true, includeDescription: true },
        filters: { keywords: [], excludeKeywords: [], maxAge: 24 }
      });
      
      await loadNotificationData();
      toast.success('RSS feed added successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to add RSS feed');
    }
  };

  const deleteRSSFeed = async (feedId) => {
    try {
      await apiRequest(`/notifications/rss/${feedId}`, {
        method: 'DELETE'
      });
      
      await loadNotificationData();
      toast.success('RSS feed removed successfully!');
    } catch (error) {
      toast.error('Failed to remove RSS feed');
    }
  };

  const createSocialAccount = async () => {
    if (!newSocialAccount.username || !newSocialAccount.channelId) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await apiRequest('/notifications/social', {
        method: 'POST',
        body: JSON.stringify(newSocialAccount)
      });
      
      setNewSocialAccount({
        platform: 'youtube',
        username: '',
        channelId: '',
        notifications: { newPosts: true, liveStreams: true, newVideos: true },
        embed: { enabled: true, color: '#1DA1F2', includeMedia: true }
      });
      
      await loadNotificationData();
      toast.success('Social media account added successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to add social media account');
    }
  };

  const deleteSocialAccount = async (accountId) => {
    try {
      await apiRequest(`/notifications/social/${accountId}`, {
        method: 'DELETE'
      });
      
      await loadNotificationData();
      toast.success('Social media account removed successfully!');
    } catch (error) {
      toast.error('Failed to remove social media account');
    }
  };

  const validateTimeFormat = (timeString) => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString);
  };

  const createScheduledMessage = async () => {
    if (!newScheduledMessage.name || !newScheduledMessage.content || !newScheduledMessage.channelId) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!validateTimeFormat(newScheduledMessage.schedule.time)) {
      toast.error('Please enter a valid time in 24-hour format (HH:MM)');
      return;
    }

    // Ensure date is set for 'once' type
    if (newScheduledMessage.schedule.type === 'once' && !newScheduledMessage.schedule.date) {
      setNewScheduledMessage(prev => ({
        ...prev,
        schedule: {
          ...prev.schedule,
          date: new Date().toISOString().split('T')[0]
        }
      }));
      toast.error('Please select a date for one-time messages');
      return;
    }

    try {
      await apiRequest('/notifications/scheduled', {
        method: 'POST',
        body: JSON.stringify(newScheduledMessage)
      });
      
      setNewScheduledMessage({
        name: '',
        content: '',
        channelId: '',
        schedule: { 
          type: 'daily', 
          time: getCurrentTime24h(),
          timezone: userTimezone,
          date: new Date().toISOString().split('T')[0]
        },
        embed: null
      });
      
      await loadNotificationData();
      toast.success('Scheduled message added successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to add scheduled message');
    }
  };

  const deleteScheduledMessage = async (messageId) => {
    try {
      await apiRequest(`/notifications/scheduled/${messageId}`, {
        method: 'DELETE'
      });
      
      await loadNotificationData();
      toast.success('Scheduled message removed successfully!');
    } catch (error) {
      toast.error('Failed to remove scheduled message');
    }
  };

  const testScheduledMessage = async (messageId) => {
    try {
      setLoading(true);
      await apiRequest(`/notifications/scheduled/${messageId}/test`, {
        method: 'POST'
      });
      
      await loadNotificationData();
      toast.success('Scheduled message sent successfully!');
    } catch (error) {
      toast.error('Failed to send scheduled message');
    } finally {
      setLoading(false);
    }
  };

  const testRSSFeed = async () => {
    if (!testDialog.url) {
      toast.error('Please enter an RSS URL');
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest('/notifications/rss/test', {
        method: 'POST',
        body: JSON.stringify({ url: testDialog.url })
      });
      
      setTestDialog(prev => ({ ...prev, result: result.feedInfo }));
    } catch (error) {
      toast.error('Invalid RSS feed URL');
      setTestDialog(prev => ({ ...prev, result: null }));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getScheduleDescription = (schedule) => {
    const timeDisplay = formatTimeDisplay(schedule.time, schedule.timezone);
    
    switch (schedule.type) {
      case 'daily':
        return `Daily at ${timeDisplay}`;
      case 'weekly':
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Weekly on ${days[schedule.dayOfWeek]} at ${timeDisplay}`;
      case 'monthly':
        return `Monthly on day ${schedule.dayOfMonth} at ${timeDisplay}`;
      case 'once':
        return `Once on ${schedule.date} at ${timeDisplay}`;
      default:
        return 'Unknown schedule';
    }
  };

  const renderTimeInputs = () => (
    <>
      <Grid item xs={12} sm={4}>
        <FormControl fullWidth>
          <InputLabel>Schedule Type</InputLabel>
          <Select
            value={newScheduledMessage.schedule.type}
            onChange={(e) => setNewScheduledMessage(prev => ({
              ...prev,
              schedule: { ...prev.schedule, type: e.target.value }
            }))}
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
          label="Time (24h)"
          value={newScheduledMessage.schedule.time}
          onChange={(e) => setNewScheduledMessage(prev => ({
            ...prev,
            schedule: { ...prev.schedule, time: e.target.value }
          }))}
          inputProps={{
            step: 60, // 1 minute steps
            pattern: "[0-9]{2}:[0-9]{2}" // Force 24-hour format
          }}
          helperText="24-hour format (HH:MM)"
          sx={{
            '& input[type="time"]': {
              colorScheme: 'dark', // This helps force 24h in some browsers
            },
            '& input[type="time"]::-webkit-calendar-picker-indicator': {
              filter: 'invert(1)', // Makes the clock icon visible in dark mode
            }
          }}
        />
      </Grid>
      
      <Grid item xs={12} sm={4}>
        <FormControl fullWidth>
          <InputLabel>Timezone</InputLabel>
          <Select
            value={newScheduledMessage.schedule.timezone}
            onChange={(e) => setNewScheduledMessage(prev => ({
              ...prev,
              schedule: { ...prev.schedule, timezone: e.target.value }
            }))}
          >
            <MenuItem value={userTimezone}>
              <Box display="flex" alignItems="center">
                🌍 {userTimezone.replace('_', ' ')} (Your timezone)
              </Box>
            </MenuItem>
            <MenuItem value="UTC">🌐 UTC (Coordinated Universal Time)</MenuItem>
            <MenuItem value="America/New_York">🇺🇸 Eastern Time (New York)</MenuItem>
            <MenuItem value="America/Chicago">🇺🇸 Central Time (Chicago)</MenuItem>
            <MenuItem value="America/Denver">🇺🇸 Mountain Time (Denver)</MenuItem>
            <MenuItem value="America/Los_Angeles">🇺🇸 Pacific Time (Los Angeles)</MenuItem>
            <MenuItem value="Europe/London">🇬🇧 London (GMT/BST)</MenuItem>
            <MenuItem value="Europe/Paris">🇫🇷 Paris (CET/CEST)</MenuItem>
            <MenuItem value="Europe/Berlin">🇩🇪 Berlin (CET/CEST)</MenuItem>
            <MenuItem value="Europe/Rome">🇮🇹 Rome (CET/CEST)</MenuItem>
            <MenuItem value="Europe/Madrid">🇪🇸 Madrid (CET/CEST)</MenuItem>
            <MenuItem value="Asia/Tokyo">🇯🇵 Tokyo (JST)</MenuItem>
            <MenuItem value="Asia/Shanghai">🇨🇳 Shanghai (CST)</MenuItem>
            <MenuItem value="Asia/Kolkata">🇮🇳 India (IST)</MenuItem>
            <MenuItem value="Australia/Sydney">🇦🇺 Sydney (AEST/AEDT)</MenuItem>
          </Select>
        </FormControl>
      </Grid>
    </>
  );

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            <NotificationsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Smart Notifications System
          </Typography>
          
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton onClick={loadNotificationData} color="primary" size="small">
              <RefreshIcon />
            </IconButton>
            <Chip 
              label={`${Object.keys(notificationData.rssFeeds || {}).length} RSS`} 
              color="primary"
              size="small"
            />
            <Chip 
              label={`${Object.keys(notificationData.socialMedia || {}).length} Social`} 
              color="success"
              size="small"
            />
            <Chip 
              label={`${Object.keys(notificationData.scheduledMessages || {}).length} Scheduled`} 
              color="warning"
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
          <Tab label="RSS Feeds" />
          <Tab label="Social Media" />
          <Tab label="Scheduled Messages" />
          <Tab label="Webhooks" />
        </Tabs>

        <Box sx={{ mt: 3 }}>
          {/* RSS Feeds Tab */}
          {tabValue === 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">
                    <RssIcon sx={{ mr: 1 }} />
                    Add RSS Feed
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Feed Name"
                        value={newRSSFeed.name}
                        onChange={(e) => setNewRSSFeed(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Tech News"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box display="flex" gap={1}>
                        <TextField
                          fullWidth
                          label="RSS URL"
                          value={newRSSFeed.url}
                          onChange={(e) => setNewRSSFeed(prev => ({ ...prev, url: e.target.value }))}
                          placeholder="https://example.com/feed.xml"
                        />
                        <Button
                          variant="outlined"
                          onClick={() => setTestDialog({ open: true, url: newRSSFeed.url, result: null })}
                          startIcon={<TestIcon />}
                          disabled={!newRSSFeed.url}
                        >
                          Test
                        </Button>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Channel</InputLabel>
                        <Select
                          value={newRSSFeed.channelId}
                          onChange={(e) => setNewRSSFeed(prev => ({ ...prev, channelId: e.target.value }))}
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
                      <TextField
                        fullWidth
                        type="number"
                        label="Max Age (hours)"
                        value={newRSSFeed.filters.maxAge}
                        onChange={(e) => setNewRSSFeed(prev => ({
                          ...prev,
                          filters: { ...prev.filters, maxAge: parseInt(e.target.value) }
                        }))}
                        inputProps={{ min: 1, max: 168 }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={newRSSFeed.embed.enabled}
                            onChange={(e) => setNewRSSFeed(prev => ({
                              ...prev,
                              embed: { ...prev.embed, enabled: e.target.checked }
                            }))}
                          />
                        }
                        label="Use Rich Embeds"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        variant="contained"
                        onClick={createRSSFeed}
                        disabled={!newRSSFeed.name || !newRSSFeed.url || !newRSSFeed.channelId}
                      >
                        Add RSS Feed
                      </Button>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Active RSS Feeds ({Object.keys(notificationData.rssFeeds || {}).length})
              </Typography>
              
              {Object.keys(notificationData.rssFeeds || {}).length === 0 ? (
                <Alert severity="info">
                  No RSS feeds configured yet. Add your first RSS feed above!
                </Alert>
              ) : (
                <List>
                  {Object.values(notificationData.rssFeeds || {}).map((feed) => (
                    <ListItem key={feed.id} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, mb: 1 }}>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle1">{feed.name}</Typography>
                            <Chip 
                              label={feed.enabled ? 'Active' : 'Disabled'}
                              color={feed.enabled ? 'success' : 'default'}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography variant="body2" color="textSecondary" component="span" display="block">
                              {feed.url}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" component="span" display="block">
                              {feed.itemCount || 0} items • Last check: {feed.lastCheck ? formatTime(feed.lastCheck) : 'Never'}
                            </Typography>
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          onClick={() => deleteRSSFeed(feed.id)}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </motion.div>
          )}

          {/* Social Media Tab */}
          {tabValue === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">
                    <YouTubeIcon sx={{ mr: 1 }} />
                    Add Social Media Account
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Platform</InputLabel>
                        <Select
                          value={newSocialAccount.platform}
                          onChange={(e) => setNewSocialAccount(prev => ({ ...prev, platform: e.target.value }))}
                        >
                          <MenuItem value="youtube">
                            <Box display="flex" alignItems="center">
                              <YouTubeIcon sx={{ mr: 1 }} />
                              YouTube
                            </Box>
                          </MenuItem>
                          <MenuItem value="twitch">
                            <Box display="flex" alignItems="center">
                              <SettingsIcon sx={{ mr: 1 }} />
                              Twitch
                            </Box>
                          </MenuItem>
                          <MenuItem value="twitter">
                            <Box display="flex" alignItems="center">
                              <TwitterIcon sx={{ mr: 1 }} />
                              Twitter
                            </Box>
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Username/Channel ID"
                        value={newSocialAccount.username}
                        onChange={(e) => setNewSocialAccount(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="@username or channel ID"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Notification Channel</InputLabel>
                        <Select
                          value={newSocialAccount.channelId}
                          onChange={(e) => setNewSocialAccount(prev => ({ ...prev, channelId: e.target.value }))}
                        >
                          {channels.map(channel => (
                            <MenuItem key={channel.id} value={channel.id}>
                              # {channel.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        variant="contained"
                        onClick={createSocialAccount}
                        disabled={!newSocialAccount.username || !newSocialAccount.channelId}
                      >
                        Add Social Media Account
                      </Button>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Social Media Accounts ({Object.keys(notificationData.socialMedia || {}).length})
              </Typography>
              
              {Object.keys(notificationData.socialMedia || {}).length === 0 ? (
                <Alert severity="info">
                  No social media accounts configured yet. Add your first account above!
                </Alert>
              ) : (
                <List>
                  {Object.values(notificationData.socialMedia || {}).map((account) => (
                    <ListItem key={account.id} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, mb: 1 }}>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            {account.platform === 'youtube' && <YouTubeIcon />}
                            {account.platform === 'twitter' && <TwitterIcon />}
                            <Typography variant="subtitle1">{account.username}</Typography>
                            <Chip 
                              label={account.platform}
                              color="primary"
                              size="small"
                            />
                            <Chip 
                              label={account.enabled ? 'Active' : 'Disabled'}
                              color={account.enabled ? 'success' : 'default'}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="textSecondary" component="span" display="block">
                            {account.postCount || 0} notifications sent • Last check: {account.lastCheck ? formatTime(account.lastCheck) : 'Never'}
                          </Typography>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          onClick={() => deleteSocialAccount(account.id)}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </motion.div>
          )}

          {/* Scheduled Messages Tab */}
          {tabValue === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                    <Typography variant="h6">
                      <ScheduleIcon sx={{ mr: 1 }} />
                      Add Scheduled Message
                    </Typography>
                    <Chip 
                      label={`🌍 ${userTimezone.replace('_', ' ')}`}
                      size="small"
                      color="info"
                      sx={{ ml: 2 }}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Message Name"
                        value={newScheduledMessage.name}
                        onChange={(e) => setNewScheduledMessage(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Daily Reminder"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Channel</InputLabel>
                        <Select
                          value={newScheduledMessage.channelId}
                          onChange={(e) => setNewScheduledMessage(prev => ({ ...prev, channelId: e.target.value }))}
                        >
                          {channels.map(channel => (
                            <MenuItem key={channel.id} value={channel.id}>
                              # {channel.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Message Content"
                        value={newScheduledMessage.content}
                        onChange={(e) => setNewScheduledMessage(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="Good morning everyone! 🌅"
                        inputProps={{ maxLength: 2000 }}
                        helperText={`${newScheduledMessage.content.length}/2000 characters`}
                      />
                    </Grid>
                    
                    {/* Use the new time inputs */}
                    {renderTimeInputs()}
                    
                    {/* Additional fields based on schedule type */}
                    {newScheduledMessage.schedule.type === 'weekly' && (
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Day of Week</InputLabel>
                          <Select
                            value={newScheduledMessage.schedule.dayOfWeek || 1}
                            onChange={(e) => setNewScheduledMessage(prev => ({
                              ...prev,
                              schedule: { ...prev.schedule, dayOfWeek: e.target.value }
                            }))}
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
                    
                    {newScheduledMessage.schedule.type === 'monthly' && (
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Day of Month"
                          value={newScheduledMessage.schedule.dayOfMonth || 1}
                          onChange={(e) => setNewScheduledMessage(prev => ({
                            ...prev,
                            schedule: { ...prev.schedule, dayOfMonth: parseInt(e.target.value) }
                          }))}
                          inputProps={{ min: 1, max: 31 }}
                        />
                      </Grid>
                    )}
                    
                    {newScheduledMessage.schedule.type === 'once' && (
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="date"
                          label="Date"
                          value={newScheduledMessage.schedule.date || new Date().toISOString().split('T')[0]}
                          onChange={(e) => setNewScheduledMessage(prev => ({
                            ...prev,
                            schedule: { ...prev.schedule, date: e.target.value }
                          }))}
                          inputProps={{
                            min: new Date().toISOString().split('T')[0] // Can't schedule in the past
                          }}
                        />
                      </Grid>
                    )}
                    
                    <Grid item xs={12}>
                      <Box display="flex" alignItems="center" gap={2} mb={2}>
                        <Typography variant="body2" color="textSecondary">
                          Preview: {getScheduleDescription(newScheduledMessage.schedule)}
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        onClick={createScheduledMessage}
                        disabled={!newScheduledMessage.name || !newScheduledMessage.content || !newScheduledMessage.channelId}
                      >
                        Add Scheduled Message
                      </Button>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Scheduled Messages ({Object.keys(notificationData.scheduledMessages || {}).length})
              </Typography>
              
              {Object.keys(notificationData.scheduledMessages || {}).length === 0 ? (
                <Alert severity="info">
                  No scheduled messages configured yet. Add your first scheduled message above!
                </Alert>
              ) : (
                <List>
                  {Object.values(notificationData.scheduledMessages || {}).map((schedMessage) => (
                    <ListItem key={schedMessage.id} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, mb: 1 }}>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle1">{schedMessage.name}</Typography>
                            <Chip 
                              label={schedMessage.schedule.type}
                              color="warning"
                              size="small"
                            />
                            <Chip 
                              label={schedMessage.enabled ? 'Active' : 'Disabled'}
                              color={schedMessage.enabled ? 'success' : 'default'}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography variant="body2" color="textSecondary" component="span" display="block">
                              {getScheduleDescription(schedMessage.schedule)}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" component="span" display="block">
                              Sent {schedMessage.sentCount || 0} times • Last sent: {schedMessage.lastSent ? formatTime(schedMessage.lastSent) : 'Never'}
                            </Typography>
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Box display="flex" gap={1}>
                          <IconButton
                            onClick={() => testScheduledMessage(schedMessage.id)}
                            color="primary"
                            size="small"
                            disabled={loading}
                          >
                            <PlayIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => deleteScheduledMessage(schedMessage.id)}
                            color="error"
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </motion.div>
          )}

          {/* Webhooks Tab */}
          {tabValue === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Alert severity="info" sx={{ mb: 3 }}>
                Webhooks allow external services to send notifications to your Discord server. 
                Each webhook gets a unique URL that external services can POST to.
              </Alert>

              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">
                    <WebhookIcon sx={{ mr: 1 }} />
                    Create Webhook
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Webhook Name"
                        value={newWebhook.name}
                        onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="GitHub Notifications"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Channel</InputLabel>
                        <Select
                          value={newWebhook.channelId}
                          onChange={(e) => setNewWebhook(prev => ({ ...prev, channelId: e.target.value }))}
                        >
                          {channels.map(channel => (
                            <MenuItem key={channel.id} value={channel.id}>
                              # {channel.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Secret (Optional)"
                        value={newWebhook.secret}
                        onChange={(e) => setNewWebhook(prev => ({ ...prev, secret: e.target.value }))}
                        placeholder="Optional security secret"
                        helperText="Used to verify webhook authenticity"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        variant="contained"
                        onClick={() => {
                          toast.success('Webhook creation coming soon!');
                        }}
                        disabled={!newWebhook.name || !newWebhook.channelId}
                      >
                        Create Webhook
                      </Button>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Active Webhooks ({Object.keys(notificationData.webhooks || {}).length})
              </Typography>
              
              {Object.keys(notificationData.webhooks || {}).length === 0 ? (
                <Alert severity="info">
                  No webhooks configured yet. Create your first webhook above!
                </Alert>
              ) : (
                <List>
                  {Object.values(notificationData.webhooks || {}).map((webhook) => (
                    <ListItem key={webhook.id} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, mb: 1 }}>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle1">{webhook.name}</Typography>
                            <Chip 
                              label={webhook.enabled ? 'Active' : 'Disabled'}
                              color={webhook.enabled ? 'success' : 'default'}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="textSecondary" component="span" display="block">
                            {webhook.eventCount || 0} events received
                          </Typography>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          onClick={() => {
                            toast.success('Webhook deletion coming soon!');
                          }}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </motion.div>
          )}
        </Box>
      </CardContent>

      {/* RSS Test Dialog */}
      <Dialog
        open={testDialog.open}
        onClose={() => setTestDialog({ open: false, url: '', result: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Test RSS Feed</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="RSS Feed URL"
            value={testDialog.url}
            onChange={(e) => setTestDialog(prev => ({ ...prev, url: e.target.value }))}
            placeholder="https://example.com/feed.xml"
            sx={{ mb: 2 }}
          />
          
          {testDialog.result && (
            <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="h6" gutterBottom>
                Feed Information
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Title:</strong> {testDialog.result.title}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Description:</strong> {testDialog.result.description}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Items:</strong> {testDialog.result.itemCount}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Last Updated:</strong> {testDialog.result.lastUpdated || 'Unknown'}
              </Typography>
              
              {testDialog.result.sampleItems && testDialog.result.sampleItems.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                    Recent Items:
                  </Typography>
                  {testDialog.result.sampleItems.map((item, index) => (
                    <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {item.title}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {item.pubDate}
                      </Typography>
                    </Box>
                  ))}
                </>
              )}
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialog({ open: false, url: '', result: null })}>
            Close
          </Button>
          <Button 
            variant="contained" 
            onClick={testRSSFeed}
            disabled={!testDialog.url || loading}
            startIcon={loading ? <CircularProgress size={16} /> : <TestIcon />}
          >
            {loading ? 'Testing...' : 'Test Feed'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default NotificationPanel;
