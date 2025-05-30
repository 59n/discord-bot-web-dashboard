import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Grid,
  Tabs,
  Tab
} from '@mui/material';
import { motion } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';

const ControlPanel = ({ socket }) => {
  const [tabValue, setTabValue] = useState(0);
  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('online');
  const [activity, setActivity] = useState('');
  const [activityType, setActivityType] = useState('playing');

  useEffect(() => {
    loadGuilds();
  }, []);

  const loadGuilds = async () => {
    try {
      const response = await axios.get('/api/guilds');
      setGuilds(response.data);
    } catch (error) {
      toast.error('Failed to load servers');
    }
  };

  const sendMessage = async () => {
    if (!selectedChannel || !message) {
      toast.error('Please select a channel and enter a message');
      return;
    }

    try {
      await axios.post('/api/send-message', {
        channelId: selectedChannel,
        message
      });
      setMessage('');
      toast.success('Message sent successfully!');
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const updateStatus = async () => {
    try {
      await axios.post('/api/change-status', {
        status,
        activity,
        activityType
      });
      toast.success('Status updated successfully!');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const selectedGuildData = guilds.find(g => g.id === selectedGuild);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Bot Controls
        </Typography>
        
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Send Message" />
          <Tab label="Bot Status" />
        </Tabs>

        <Box sx={{ mt: 3 }}>
          {tabValue === 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Server</InputLabel>
                    <Select
                      value={selectedGuild}
                      onChange={(e) => {
                        setSelectedGuild(e.target.value);
                        setSelectedChannel('');
                      }}
                    >
                      {guilds.map(guild => (
                        <MenuItem key={guild.id} value={guild.id}>
                          {guild.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth disabled={!selectedGuild}>
                    <InputLabel>Channel</InputLabel>
                    <Select
                      value={selectedChannel}
                      onChange={(e) => setSelectedChannel(e.target.value)}
                    >
                      {selectedGuildData?.channels.map(channel => (
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
                    rows={4}
                    label="Message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter your message..."
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={sendMessage}
                    disabled={!selectedChannel || !message}
                    sx={{ height: 48 }}
                  >
                    Send Message
                  </Button>
                </Grid>
              </Grid>
            </motion.div>
          )}

          {tabValue === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <MenuItem value="online">🟢 Online</MenuItem>
                      <MenuItem value="idle">🟡 Idle</MenuItem>
                      <MenuItem value="dnd">🔴 Do Not Disturb</MenuItem>
                      <MenuItem value="invisible">⚫ Invisible</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Activity Type</InputLabel>
                    <Select
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value)}
                    >
                      <MenuItem value="playing">🎮 Playing</MenuItem>
                      <MenuItem value="streaming">📺 Streaming</MenuItem>
                      <MenuItem value="listening">🎵 Listening</MenuItem>
                      <MenuItem value="watching">👀 Watching</MenuItem>
                      <MenuItem value="competing">🏆 Competing</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Activity"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    placeholder="What is the bot doing?"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={updateStatus}
                    sx={{ height: 48 }}
                  >
                    Update Status
                  </Button>
                </Grid>
              </Grid>
            </motion.div>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ControlPanel;
