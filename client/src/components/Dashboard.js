import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Paper,
  Card,
  CardContent,
  Button,
  Chip,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  Logout as LogoutIcon,
  AccountCircle as AccountIcon,
  Security as SecurityIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import useSocket from '../hooks/useSocket';
import CommandBuilder from './CommandBuilder';
import TicketPanel from './TicketPanel';
import SecurityPanel from './SecurityPanel';
import { isAuthenticated, removeAuthToken, getAuthToken } from '../utils/auth';
import { hasPermission, canAccessComponent, getRoleDescription } from '../utils/permissions';
import LoginForm from './LoginForm';
import toast from 'react-hot-toast';
import ModerationPanel from './ModerationPanel';
import AnalyticsPanel from './AnalyticsPanel';
import NotificationPanel from './NotificationPanel';
import ButtonRolePanel from './ButtonRolePanel'; // ADD THIS IMPORT

const Dashboard = () => {
  // ALL hooks must be called first
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const { socket, isConnected } = useSocket();

  // Motion variants - declared before any usage
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.1,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      console.log('Checking authentication...');
      const authenticated = isAuthenticated();
      setIsLoggedIn(authenticated);
      
      if (authenticated) {
        try {
          const token = getAuthToken();
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.log('Token payload:', payload);
            const userData = {
              id: payload.id,
              username: payload.username,
              role: payload.role
            };
            setUser(userData);
            console.log('User set:', userData);
          }
        } catch (error) {
          console.error('Error parsing token:', error);
          handleLogout();
        }
      }
      
      // Set loading to false AFTER authentication check
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('Current user in Dashboard:', user);
    console.log('User role:', user?.role);
    console.log('Loading state:', loading);
  }, [user, loading]);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    setLoading(false);
    toast.success(`Welcome back, ${userData.username}!`);
  };

  const handleLogout = () => {
    removeAuthToken();
    setUser(null);
    setIsLoggedIn(false);
    setAnchorEl(null);
    setLoading(false);
    toast.success('Logged out successfully');
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Show loading state FIRST
  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <Card>
          <CardContent>
            <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
              <CircularProgress />
              <Typography variant="h6" textAlign="center">
                Loading Dashboard...
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Show login form if not authenticated
  if (!isLoggedIn) {
    return <LoginForm onLogin={handleLogin} />;
  }

  // Permission checks for components
  const canViewCommands = user && hasPermission(user.role, 'VIEW_COMMANDS');
  const canViewTickets = user && hasPermission(user.role, 'VIEW_TICKETS');
  const canManageSecurity = user && hasPermission(user.role, 'MANAGE_SECURITY');

  // ONLY render main dashboard when user is loaded AND authenticated
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header with User Info */}
        <Box mb={4}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <DashboardIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0 }}>
                  Discord Bot Dashboard
                </Typography>
                <Typography variant="subtitle1" color="textSecondary">
                  Manage your Discord bot with ease
                </Typography>
              </Box>
            </Box>

            {/* User Menu */}
            <Box display="flex" alignItems="center" gap={2}>
              {/* Connection Status */}
              <Chip 
                label={isConnected ? '🟢 Bot Online' : '🔴 Bot Offline'}
                color={isConnected ? 'success' : 'error'}
                variant="outlined"
              />

              {/* User Info */}
              {user && (
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip 
                    label={user.role}
                    color={user.role === 'admin' ? 'error' : user.role === 'moderator' ? 'warning' : 'default'}
                    size="small"
                  />
                  <IconButton onClick={handleMenuOpen} color="inherit">
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                      {user.username[0].toUpperCase()}
                    </Avatar>
                  </IconButton>
                </Box>
              )}

              {/* User Menu Dropdown */}
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem disabled>
                  <Box>
                    <Typography variant="subtitle2">{user?.username}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {user?.role} user
                    </Typography>
                  </Box>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleMenuClose}>
                  <AccountIcon sx={{ mr: 1 }} />
                  Profile Settings
                </MenuItem>
                <MenuItem onClick={handleMenuClose}>
                  <SecurityIcon sx={{ mr: 1 }} />
                  Security Settings
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                  <LogoutIcon sx={{ mr: 1 }} />
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          </Box>

          {/* Connection Status Banner */}
          <motion.div variants={itemVariants}>
            <Paper 
              elevation={1} 
              sx={{ 
                p: 2, 
                bgcolor: isConnected ? 'success.dark' : 'error.dark',
                color: 'white',
                borderRadius: 2
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">
                  {isConnected 
                    ? '🟢 Bot is online and connected to Discord' 
                    : '🔴 Bot is offline or disconnected from Discord'
                  }
                </Typography>
                {socket && (
                  <Chip 
                    label={`Socket: ${socket.connected ? 'Connected' : 'Disconnected'}`}
                    size="small"
                    sx={{ 
                      bgcolor: 'rgba(255,255,255,0.2)',
                      color: 'white'
                    }}
                  />
                )}
              </Box>
            </Paper>
          </motion.div>

          {/* Role Information */}
          <motion.div variants={itemVariants}>
            <Box mt={2}>
              <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                <Typography variant="body2" color="textSecondary">
                  <strong>Your Role:</strong> {user?.role} | <strong>Permissions:</strong> {getRoleDescription(user?.role)}
                </Typography>
              </Paper>
            </Box>
          </motion.div>
        </Box>

        <Grid container spacing={3}>
          {/* Command Builder - Show for admin and moderator */}
          {canViewCommands && (
            <Grid item xs={12}>
              <motion.div variants={itemVariants}>
                <CommandBuilder socket={socket} user={user} />
              </motion.div>
            </Grid>
          )}

          {/* Ticket Panel - Show based on permissions */}
          {canViewTickets && (
            <Grid item xs={12}>
              <motion.div variants={itemVariants}>
                <TicketPanel socket={socket} user={user} />
              </motion.div>
            </Grid>
          )}

          {/* Button Role Panel - Show for admin and moderator */}
          {user && ['admin', 'moderator'].includes(user.role) && (
            <Grid item xs={12}>
              <motion.div variants={itemVariants}>
                <ButtonRolePanel socket={socket} user={user} />
              </motion.div>
            </Grid>
          )}

          {/* Moderation Panel - Show for admin and moderator */}
          {user && ['admin', 'moderator'].includes(user.role) && (
            <Grid item xs={12}>
              <motion.div variants={itemVariants}>
                <ModerationPanel socket={socket} user={user} />
              </motion.div>
            </Grid>
          )}

          {/* Analytics Panel - Show for admin and moderator */}
          {user && ['admin', 'moderator'].includes(user.role) && (
            <Grid item xs={12}>
              <motion.div variants={itemVariants}>
                <AnalyticsPanel socket={socket} user={user} />
              </motion.div>
            </Grid>
          )}

          {/* Notification Panel - Show for admin and moderator */}
          {user && ['admin', 'moderator'].includes(user.role) && (
            <Grid item xs={12}>
              <motion.div variants={itemVariants}>
                <NotificationPanel socket={socket} user={user} />
              </motion.div>
            </Grid>
          )}

          {/* Security Panel - Admin only */}
          {canManageSecurity && (
            <Grid item xs={12}>
              <motion.div variants={itemVariants}>
                <SecurityPanel socket={socket} user={user} />
              </motion.div>
            </Grid>
          )}

          {/* No Access Message */}
          {user && !canViewCommands && !canViewTickets && !canManageSecurity && (
            <Grid item xs={12}>
              <motion.div variants={itemVariants}>
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
                  <Typography variant="h6" gutterBottom color="warning.main">
                    Limited Access
                  </Typography>
                  <Typography variant="body1" color="textSecondary" gutterBottom>
                    Your current role ({user.role}) has limited access to dashboard features.
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Contact an administrator to request additional permissions.
                  </Typography>
                </Paper>
              </motion.div>
            </Grid>
          )}

          {/* Footer */}
          <Grid item xs={12}>
            <motion.div variants={itemVariants}>
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper' }}>
                <Typography variant="body2" color="textSecondary">
                  Discord Bot Dashboard v1.0.0 | Built with React & Material-UI
                </Typography>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
                  Logged in as: <strong>{user?.username}</strong> ({user?.role})
                </Typography>
                <Box mt={2} display="flex" justifyContent="center" gap={1}>
                  <Chip 
                    label={`Commands: ${canViewCommands ? 'Accessible' : 'Restricted'}`}
                    size="small"
                    color={canViewCommands ? 'success' : 'default'}
                  />
                  <Chip 
                    label={`Tickets: ${canViewTickets ? 'Accessible' : 'Restricted'}`}
                    size="small"
                    color={canViewTickets ? 'success' : 'default'}
                  />
                  <Chip 
                    label={`Button Roles: ${user && ['admin', 'moderator'].includes(user.role) ? 'Accessible' : 'Restricted'}`}
                    size="small"
                    color={user && ['admin', 'moderator'].includes(user.role) ? 'success' : 'default'}
                  />
                  <Chip 
                    label={`Moderation: ${user && ['admin', 'moderator'].includes(user.role) ? 'Accessible' : 'Restricted'}`}
                    size="small"
                    color={user && ['admin', 'moderator'].includes(user.role) ? 'success' : 'default'}
                  />
                  <Chip 
                    label={`Security: ${canManageSecurity ? 'Accessible' : 'Restricted'}`}
                    size="small"
                    color={canManageSecurity ? 'success' : 'default'}
                  />
                </Box>
              </Paper>
            </motion.div>
          </Grid>
        </Grid>

      </motion.div>
    </Container>
  );
};

export default Dashboard;
