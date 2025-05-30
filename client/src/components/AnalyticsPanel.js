import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  People as PeopleIcon,
  Message as MessageIcon,
  VoiceChat as VoiceChatIcon,
  Terminal as TerminalIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Add as AddIcon  
} from '@mui/icons-material';

import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import toast from 'react-hot-toast';

const AnalyticsPanel = ({ socket, user }) => {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('7d');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [realTimeStats, setRealTimeStats] = useState({});

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
    loadAnalyticsData();
    loadRealTimeStats();
    
    // Refresh real-time stats every 30 seconds
    const interval = setInterval(loadRealTimeStats, 30000);
    return () => clearInterval(interval);
  }, [period]);

  useEffect(() => {
    if (socket) {
      socket.on('memberJoined', () => {
        loadRealTimeStats();
      });

      socket.on('memberLeft', () => {
        loadRealTimeStats();
      });

      return () => {
        socket.off('memberJoined');
        socket.off('memberLeft');
      };
    }
  }, [socket]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/analytics?period=${period}`);
      setAnalyticsData(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const generateTestData = async () => {
    try {
      setLoading(true);
      await apiRequest('/analytics/generate-test-data', {
        method: 'POST'
      });
      
      await loadAnalyticsData();
      toast.success('Test data generated successfully!');
    } catch (error) {
      toast.error('Failed to generate test data');
    } finally {
      setLoading(false);
    }
  };

  const loadRealTimeStats = async () => {
    try {
      const stats = await apiRequest('/analytics/realtime');
      setRealTimeStats(stats);
    } catch (error) {
      console.error('Failed to load real-time stats:', error);
    }
  };

  const exportData = async (format = 'json') => {
    try {
      const response = await fetch(
        `${process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3000/api'}/analytics/export?period=${period}&format=${format}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );
      
      if (format === 'csv') {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics-${period}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics-${period}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      toast.success(`Analytics exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export analytics');
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];

  if (loading && !analyticsData) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Loading analytics...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">
            <AnalyticsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Server Analytics Dashboard
          </Typography>
          
          <Box display="flex" alignItems="center" gap={2}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Period</InputLabel>
              <Select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <MenuItem value="24h">Last 24 Hours</MenuItem>
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
                <MenuItem value="90d">Last 90 Days</MenuItem>
              </Select>
            </FormControl>
            
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadAnalyticsData}
              disabled={loading}
            >
              Refresh
            </Button>

            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={generateTestData}
              disabled={loading}
              color="secondary"
            >
              Generate Test Data
            </Button>
                        
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => exportData('csv')}
            >
              Export CSV
            </Button>
          </Box>
        </Box>

        {/* Real-time Stats Cards */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'primary.dark', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <PeopleIcon sx={{ mr: 2, fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4">{realTimeStats.activeUsers || 0}</Typography>
                    <Typography variant="body2">Active Users</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'success.dark', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <MessageIcon sx={{ mr: 2, fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4">{realTimeStats.messagesLastHour || 0}</Typography>
                    <Typography variant="body2">Messages/Hour</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'warning.dark', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <VoiceChatIcon sx={{ mr: 2, fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4">{realTimeStats.currentVoiceUsers || 0}</Typography>
                    <Typography variant="body2">In Voice</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'info.dark', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <TerminalIcon sx={{ mr: 2, fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4">{realTimeStats.commandsLastHour || 0}</Typography>
                    <Typography variant="body2">Commands/Hour</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {analyticsData && (
          <Grid container spacing={3}>
            {/* Server Growth Chart */}
            <Grid item xs={12} lg={8}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Server Growth
                  {analyticsData.summary?.memberGrowth && (
                    <Chip 
                      icon={analyticsData.summary.memberGrowth.netGrowth >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                      label={`${analyticsData.summary.memberGrowth.netGrowth >= 0 ? '+' : ''}${analyticsData.summary.memberGrowth.netGrowth}`}
                      color={analyticsData.summary.memberGrowth.netGrowth >= 0 ? 'success' : 'error'}
                      sx={{ ml: 2 }}
                    />
                  )}
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analyticsData.serverGrowth || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="joins" 
                      stackId="1"
                      stroke="#82ca9d" 
                      fill="#82ca9d" 
                      name="Joins"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="leaves" 
                      stackId="2"
                      stroke="#ff7300" 
                      fill="#ff7300" 
                      name="Leaves"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* Summary Stats */}
            <Grid item xs={12} lg={4}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Summary ({period})
                </Typography>
                {analyticsData.summary && (
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Member Growth"
                        secondary={`+${analyticsData.summary.memberGrowth.joins} joins, -${analyticsData.summary.memberGrowth.leaves} leaves`}
                      />
                      <Chip 
                        label={`${analyticsData.summary.memberGrowth.netGrowth >= 0 ? '+' : ''}${analyticsData.summary.memberGrowth.netGrowth}`}
                        color={analyticsData.summary.memberGrowth.netGrowth >= 0 ? 'success' : 'error'}
                        size="small"
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="Total Messages"
                        secondary={`${formatNumber(analyticsData.summary.activity.totalMessages)} messages sent`}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="Commands Used"
                        secondary={`${formatNumber(analyticsData.summary.activity.totalCommands)} commands executed`}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="Avg Messages/User"
                        secondary={`${analyticsData.summary.engagement.avgMessagesPerUser.toFixed(1)} per user`}
                      />
                    </ListItem>
                  </List>
                )}
              </Paper>
            </Grid>

            {/* Message Activity Chart */}
            <Grid item xs={12} lg={8}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Message Activity
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.messageActivity || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="Messages"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* Top Channels */}
            <Grid item xs={12} lg={4}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Top Channels
                </Typography>
                <List>
                  {Object.values(analyticsData.channelActivity || {})
                    .sort((a, b) => b.messageCount - a.messageCount)
                    .slice(0, 5)
                    .map((channel, index) => (
                      <ListItem key={channel.channelId}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: COLORS[index % COLORS.length] }}>
                            #{index + 1}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`Channel ${channel.channelId.slice(-4)}`}
                          secondary={`${formatNumber(channel.messageCount)} messages • ${channel.uniqueUsers} users`}
                        />
                      </ListItem>
                    ))}
                </List>
              </Paper>
            </Grid>

            {/* Command Usage Chart */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Command Usage
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={
                    Object.values(analyticsData.commandUsage || {})
                      .sort((a, b) => b.totalUsage - a.totalUsage)
                      .slice(0, 10)
                  }>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="commandName" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="totalUsage" fill="#8884d8" name="Usage Count" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        )}

        {!analyticsData && !loading && (
          <Alert severity="info">
            No analytics data available yet. Data will appear as users interact with your server.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalyticsPanel;
