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
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  MenuItem,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Security as SecurityIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  VisibilityOff as VisibilityOffIcon,
  Shield as ShieldIcon,
  Key as KeyIcon,
  Lock as LockIcon,
  VpnKey as VpnKeyIcon,
  History as HistoryIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const SecurityPanel = ({ socket, user }) => {
  const [tabValue, setTabValue] = useState(0);
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    ipWhitelisting: false,
    sessionTimeout: 3600,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    },
    loginAttempts: {
      maxAttempts: 5,
      lockoutDuration: 900
    },
    encryption: true,
    auditLogging: true
  });
  
  const [users, setUsers] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [whitelistedIPs, setWhitelistedIPs] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'viewer',
    permissions: []
  });
  
  const [newIP, setNewIP] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [qrCodeDialog, setQrCodeDialog] = useState({ open: false, qrCode: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, id: null });
  
  const [securityScore, setSecurityScore] = useState(0);

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
    loadSecurityData();
  }, []);

  useEffect(() => {
    calculateSecurityScore();
  }, [securitySettings, users, whitelistedIPs]);

  useEffect(() => {
    if (socket) {
      socket.on('securityAlert', (alert) => {
        toast.error(`Security Alert: ${alert.message}`);
        setSecurityLogs(prev => [alert, ...prev]);
      });

      socket.on('newLogin', (loginData) => {
        setSecurityLogs(prev => [{
          type: 'login',
          message: `New login from ${loginData.ip}`,
          timestamp: new Date().toISOString(),
          severity: 'info'
        }, ...prev]);
      });

      return () => {
        socket.off('securityAlert');
        socket.off('newLogin');
      };
    }
  }, [socket]);

  const loadSecurityData = async () => {
    try {
      const [settings, usersData, logs, ips, sessions] = await Promise.all([
        apiRequest('/security/settings'),
        apiRequest('/security/users'),
        apiRequest('/security/logs'),
        apiRequest('/security/whitelist'),
        apiRequest('/security/sessions')
      ]);
      
      setSecuritySettings(settings);
      setUsers(usersData);
      setSecurityLogs(logs);
      setWhitelistedIPs(ips);
      setActiveSessions(sessions);
    } catch (error) {
      console.error('Failed to load security data:', error);
    }
  };

  const calculateSecurityScore = () => {
    let score = 0;
    
    // Two-factor authentication
    if (securitySettings.twoFactorEnabled) score += 25;
    
    // Strong password policy
    if (securitySettings.passwordPolicy.minLength >= 8) score += 10;
    if (securitySettings.passwordPolicy.requireUppercase) score += 5;
    if (securitySettings.passwordPolicy.requireNumbers) score += 5;
    if (securitySettings.passwordPolicy.requireSpecialChars) score += 10;
    
    // IP whitelisting
    if (securitySettings.ipWhitelisting && whitelistedIPs.length > 0) score += 15;
    
    // Audit logging
    if (securitySettings.auditLogging) score += 10;
    
    // Encryption
    if (securitySettings.encryption) score += 10;
    
    // Session timeout
    if (securitySettings.sessionTimeout <= 3600) score += 5;
    
    // Login attempt limits
    if (securitySettings.loginAttempts.maxAttempts <= 5) score += 5;
    
    setSecurityScore(Math.min(score, 100));
  };

  const saveSecuritySettings = async () => {
    try {
      await apiRequest('/security/settings', {
        method: 'POST',
        body: JSON.stringify(securitySettings)
      });
      toast.success('Security settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save security settings');
    }
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await apiRequest('/security/users', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      
      setNewUser({
        username: '',
        email: '',
        password: '',
        role: 'viewer',
        permissions: []
      });
      
      await loadSecurityData();
      toast.success('User created successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to create user');
    }
  };

  const deleteUser = async (userId) => {
    try {
      await apiRequest(`/security/users/${userId}`, {
        method: 'DELETE'
      });
      
      await loadSecurityData();
      setDeleteDialog({ open: false, type: null, id: null });
      toast.success('User deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const addWhitelistIP = async () => {
    if (!newIP) {
      toast.error('Please enter a valid IP address');
      return;
    }

    try {
      await apiRequest('/security/whitelist', {
        method: 'POST',
        body: JSON.stringify({ ip: newIP })
      });
      
      setNewIP('');
      await loadSecurityData();
      toast.success('IP address added to whitelist!');
    } catch (error) {
      toast.error('Failed to add IP to whitelist');
    }
  };

  const removeWhitelistIP = async (ip) => {
    try {
      await apiRequest(`/security/whitelist/${encodeURIComponent(ip)}`, {
        method: 'DELETE'
      });
      
      await loadSecurityData();
      toast.success('IP address removed from whitelist!');
    } catch (error) {
      toast.error('Failed to remove IP from whitelist');
    }
  };

  const enable2FA = async () => {
    try {
      const response = await apiRequest('/security/2fa/setup', {
        method: 'POST'
      });
      
      setQrCodeDialog({ open: true, qrCode: response.qrCode });
    } catch (error) {
      toast.error('Failed to setup 2FA');
    }
  };

  const terminateSession = async (sessionId) => {
    try {
      await apiRequest(`/security/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      
      await loadSecurityData();
      toast.success('Session terminated successfully!');
    } catch (error) {
      toast.error('Failed to terminate session');
    }
  };

  const exportSecurityReport = async () => {
    try {
      const response = await apiRequest('/security/export');
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `security-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Security report exported!');
    } catch (error) {
      toast.error('Failed to export security report');
    }
  };

  const getSecurityScoreColor = () => {
    if (securityScore >= 80) return 'success';
    if (securityScore >= 60) return 'warning';
    return 'error';
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Security & Privacy Center
          </Typography>
          
          <Box display="flex" alignItems="center" gap={2}>
            <Box>
              <Typography variant="caption" color="textSecondary">
                Security Score
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <LinearProgress 
                  variant="determinate" 
                  value={securityScore} 
                  color={getSecurityScoreColor()}
                  sx={{ width: 100, height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" color={`${getSecurityScoreColor()}.main`} fontWeight="bold">
                  {securityScore}/100
                </Typography>
              </Box>
            </Box>
            
            <Chip 
              icon={securitySettings.twoFactorEnabled ? <CheckCircleIcon /> : <WarningIcon />}
              label={securitySettings.twoFactorEnabled ? '2FA Enabled' : '2FA Disabled'}
              color={securitySettings.twoFactorEnabled ? 'success' : 'warning'}
              size="small"
            />
            
            <Chip 
              label={user?.role || 'Unknown'}
              color={user?.role === 'admin' ? 'error' : 'default'}
              size="small"
            />
          </Box>
        </Box>
        
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Settings" />
          <Tab label={`Users (${users.length})`} />
          <Tab label="Access Control" />
          <Tab label={`Security Logs (${securityLogs.length})`} />
          <Tab label={`Sessions (${activeSessions.length})`} />
        </Tabs>

        <Box sx={{ mt: 3 }}>
          {/* Settings Tab */}
          {tabValue === 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Grid container spacing={3}>
                {/* Two-Factor Authentication */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box display="flex" alignItems="center">
                        <VpnKeyIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Two-Factor Authentication</Typography>
                        <Chip 
                          label={securitySettings.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                          color={securitySettings.twoFactorEnabled ? 'success' : 'error'}
                          size="small"
                          sx={{ ml: 2 }}
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={securitySettings.twoFactorEnabled}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    enable2FA();
                                  } else {
                                    setSecuritySettings(prev => ({
                                      ...prev,
                                      twoFactorEnabled: false
                                    }));
                                  }
                                }}
                              />
                            }
                            label="Enable Two-Factor Authentication"
                          />
                        </Grid>
                        {!securitySettings.twoFactorEnabled && (
                          <Grid item xs={12}>
                            <Alert severity="warning">
                              Two-factor authentication is disabled. Enable it for enhanced security.
                            </Alert>
                          </Grid>
                        )}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* Password Policy */}
                <Grid item xs={12}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box display="flex" alignItems="center">
                        <LockIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Password Policy</Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Minimum Password Length"
                            value={securitySettings.passwordPolicy.minLength}
                            onChange={(e) => setSecuritySettings(prev => ({
                              ...prev,
                              passwordPolicy: {
                                ...prev.passwordPolicy,
                                minLength: parseInt(e.target.value)
                              }
                            }))}
                            inputProps={{ min: 6, max: 32 }}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={securitySettings.passwordPolicy.requireUppercase}
                                onChange={(e) => setSecuritySettings(prev => ({
                                  ...prev,
                                  passwordPolicy: {
                                    ...prev.passwordPolicy,
                                    requireUppercase: e.target.checked
                                  }
                                }))}
                              />
                            }
                            label="Require uppercase letters"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={securitySettings.passwordPolicy.requireLowercase}
                                onChange={(e) => setSecuritySettings(prev => ({
                                  ...prev,
                                  passwordPolicy: {
                                    ...prev.passwordPolicy,
                                    requireLowercase: e.target.checked
                                  }
                                }))}
                              />
                            }
                            label="Require lowercase letters"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={securitySettings.passwordPolicy.requireNumbers}
                                onChange={(e) => setSecuritySettings(prev => ({
                                  ...prev,
                                  passwordPolicy: {
                                    ...prev.passwordPolicy,
                                    requireNumbers: e.target.checked
                                  }
                                }))}
                              />
                            }
                            label="Require numbers"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={securitySettings.passwordPolicy.requireSpecialChars}
                                onChange={(e) => setSecuritySettings(prev => ({
                                  ...prev,
                                  passwordPolicy: {
                                    ...prev.passwordPolicy,
                                    requireSpecialChars: e.target.checked
                                  }
                                }))}
                              />
                            }
                            label="Require special characters"
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* Session & Login Settings */}
                <Grid item xs={12}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box display="flex" alignItems="center">
                        <KeyIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Session & Login Settings</Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Session Timeout (seconds)"
                            value={securitySettings.sessionTimeout}
                            onChange={(e) => setSecuritySettings(prev => ({
                              ...prev,
                              sessionTimeout: parseInt(e.target.value)
                            }))}
                            inputProps={{ min: 300, max: 86400 }}
                            helperText="300 = 5 minutes, 3600 = 1 hour"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Max Login Attempts"
                            value={securitySettings.loginAttempts.maxAttempts}
                            onChange={(e) => setSecuritySettings(prev => ({
                              ...prev,
                              loginAttempts: {
                                ...prev.loginAttempts,
                                maxAttempts: parseInt(e.target.value)
                              }
                            }))}
                            inputProps={{ min: 3, max: 10 }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Lockout Duration (seconds)"
                            value={securitySettings.loginAttempts.lockoutDuration}
                            onChange={(e) => setSecuritySettings(prev => ({
                              ...prev,
                              loginAttempts: {
                                ...prev.loginAttempts,
                                lockoutDuration: parseInt(e.target.value)
                              }
                            }))}
                            inputProps={{ min: 60, max: 3600 }}
                            helperText="Time to wait after max attempts"
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* General Security */}
                <Grid item xs={12}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box display="flex" alignItems="center">
                        <ShieldIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">General Security</Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={securitySettings.ipWhitelisting}
                                onChange={(e) => setSecuritySettings(prev => ({
                                  ...prev,
                                  ipWhitelisting: e.target.checked
                                }))}
                              />
                            }
                            label="Enable IP Whitelisting"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={securitySettings.auditLogging}
                                onChange={(e) => setSecuritySettings(prev => ({
                                  ...prev,
                                  auditLogging: e.target.checked
                                }))}
                              />
                            }
                            label="Enable Audit Logging"
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={securitySettings.encryption}
                                onChange={(e) => setSecuritySettings(prev => ({
                                  ...prev,
                                  encryption: e.target.checked
                                }))}
                              />
                            }
                            label="Enable Data Encryption"
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                <Grid item xs={12}>
                  <Box display="flex" gap={2}>
                    <Button
                      variant="contained"
                      onClick={saveSecuritySettings}
                      size="large"
                    >
                      Save Security Settings
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={exportSecurityReport}
                      startIcon={<DownloadIcon />}
                    >
                      Export Security Report
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </motion.div>
          )}

          {/* Users Tab */}
          {tabValue === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Create User Form */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Create New User</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Username"
                        value={newUser.username}
                        onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="johndoe"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john@example.com"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        value={newUser.password}
                        onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                        InputProps={{
                          endAdornment: (
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                            >
                              {showPassword ? <VisibilityOffIcon /> : <ViewIcon />}
                            </IconButton>
                          )
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Role</InputLabel>
                        <Select
                          value={newUser.role}
                          onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                        >
                          <MenuItem value="viewer">Viewer</MenuItem>
                          <MenuItem value="moderator">Moderator</MenuItem>
                          <MenuItem value="admin">Administrator</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        variant="contained"
                        onClick={createUser}
                        disabled={!newUser.username || !newUser.email || !newUser.password}
                      >
                        Create User
                      </Button>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* Users List */}
              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Existing Users ({users.length})
              </Typography>
              
              <TableContainer component={Paper} sx={{ bgcolor: 'transparent' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>2FA</TableCell>
                      <TableCell>Last Login</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            <Avatar sx={{ mr: 2, width: 32, height: 32 }}>
                              {user.username[0].toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2">{user.username}</Typography>
                              <Typography variant="caption" color="textSecondary">
                                {user.email}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={user.role} 
                            size="small" 
                            color={user.role === 'admin' ? 'error' : user.role === 'moderator' ? 'warning' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            icon={user.twoFactorEnabled ? <CheckCircleIcon /> : <ErrorIcon />}
                            label={user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                            size="small"
                            color={user.twoFactorEnabled ? 'success' : 'error'}
                          />
                        </TableCell>
                        <TableCell>{formatTime(user.lastLogin)}</TableCell>
                        <TableCell>
                          <Chip 
                            label={user.isActive ? 'Active' : 'Inactive'}
                            size="small"
                            color={user.isActive ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => setDeleteDialog({ open: true, type: 'user', id: user.id })}
                            color="error"
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

          {/* Access Control Tab */}
          {tabValue === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    IP Whitelist Management
                  </Typography>
                  
                  <Box display="flex" gap={2} mb={3}>
                    <TextField
                      label="IP Address"
                      value={newIP}
                      onChange={(e) => setNewIP(e.target.value)}
                      placeholder="192.168.1.100"
                      sx={{ flexGrow: 1 }}
                    />
                    <Button
                      variant="contained"
                      onClick={addWhitelistIP}
                      disabled={!newIP}
                    >
                      Add IP
                    </Button>
                  </Box>

                  <List>
                    {whitelistedIPs.map((ip, index) => (
                      <ListItem key={index} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, mb: 1 }}>
                        <ListItemText
                          primary={ip.address}
                          secondary={`Added: ${formatTime(ip.createdAt)} | Last seen: ${formatTime(ip.lastSeen)}`}
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={() => removeWhitelistIP(ip.address)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>

                  {whitelistedIPs.length === 0 && (
                    <Alert severity="info">
                      No IP addresses whitelisted. Add IP addresses to restrict access.
                    </Alert>
                  )}
                </Grid>
              </Grid>
            </motion.div>
          )}

          {/* Security Logs Tab */}
          {tabValue === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Security Logs</Typography>
                <IconButton onClick={loadSecurityData} color="primary">
                  <RefreshIcon />
                </IconButton>
              </Box>

              <List>
                {securityLogs.map((log, index) => (
                  <ListItem key={index} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, mb: 1 }}>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          {log.severity === 'error' && <ErrorIcon color="error" />}
                          {log.severity === 'warning' && <WarningIcon color="warning" />}
                          {log.severity === 'info' && <CheckCircleIcon color="info" />}
                          <Typography variant="body2">{log.message}</Typography>
                        </Box>
                      }
                      secondary={`${formatTime(log.timestamp)} | Type: ${log.type} | IP: ${log.ip || 'N/A'}`}
                    />
                  </ListItem>
                ))}
              </List>

              {securityLogs.length === 0 && (
                <Alert severity="info">
                  No security logs available.
                </Alert>
              )}
            </motion.div>
          )}

          {/* Sessions Tab */}
          {tabValue === 4 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Typography variant="h6" gutterBottom>
                Active Sessions ({activeSessions.length})
              </Typography>

              <TableContainer component={Paper} sx={{ bgcolor: 'transparent' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>IP Address</TableCell>
                      <TableCell>Device</TableCell>
                      <TableCell>Started</TableCell>
                      <TableCell>Last Activity</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{session.username}</TableCell>
                        <TableCell>{session.ipAddress}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{session.userAgent}</Typography>
                        </TableCell>
                        <TableCell>{formatTime(session.startedAt)}</TableCell>
                        <TableCell>{formatTime(session.lastActivity)}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => terminateSession(session.id)}
                          >
                            Terminate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {activeSessions.length === 0 && (
                <Alert severity="info">
                  No active sessions.
                </Alert>
              )}
            </motion.div>
          )}
        </Box>
      </CardContent>

      {/* QR Code Dialog for 2FA */}
      <Dialog
        open={qrCodeDialog.open}
        onClose={() => setQrCodeDialog({ open: false, qrCode: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Scan this QR code with your authenticator app:
          </Typography>
          {qrCodeDialog.qrCode && (
            <Box textAlign="center" my={2}>
              <img src={qrCodeDialog.qrCode} alt="2FA QR Code" style={{ maxWidth: '100%' }} />
            </Box>
          )}
          <Alert severity="info" sx={{ mt: 2 }}>
            After scanning, enter the 6-digit code from your app to complete setup.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrCodeDialog({ open: false, qrCode: null })}>
            Cancel
          </Button>
          <Button variant="contained">
            Verify & Enable
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, type: null, id: null })}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this {deleteDialog.type}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, type: null, id: null })}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              if (deleteDialog.type === 'user') {
                deleteUser(deleteDialog.id);
              }
            }}
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

export default SecurityPanel;
