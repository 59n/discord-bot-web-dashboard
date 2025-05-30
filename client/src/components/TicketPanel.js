import React, { useState, useEffect, useCallback } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Divider,
  CircularProgress,
  Tooltip,
  Badge,
  Autocomplete,
  Checkbox,
  RadioGroup,
  Radio,
  FormGroup,
  Slider,
  Stack
} from '@mui/material';
import {
  ConfirmationNumber as TicketIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Send as SendIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  History as HistoryIcon,
  Download as DownloadIcon,
  Lock as LockIcon,
  VisibilityOff as VisibilityOffIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  DragIndicator as DragIcon,
  Preview as PreviewIcon,
  Palette as PaletteIcon,
  QuestionAnswer as QuestionIcon,
  Category as CategoryIcon,
  Message as ChannelIcon,
  Group as GroupIcon,
  Timer as TimerIcon,
  AutoAwesome as AutoIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  Upload as UploadIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

// Permission utility functions
const hasPermission = (userRole, permission) => {
  const PERMISSIONS = {
    MANAGE_TICKETS: ['admin', 'moderator'],
    CONFIGURE_TICKETS: ['admin'],
    VIEW_TICKETS: ['admin', 'moderator', 'viewer'],
    CLOSE_TICKETS: ['admin', 'moderator'],
    EXPORT_TICKETS: ['admin', 'moderator'],
    MANAGE_TYPES: ['admin'],
    VIEW_ANALYTICS: ['admin', 'moderator']
  };
  return PERMISSIONS[permission]?.includes(userRole) || false;
};

const TicketPanel = ({ socket, user }) => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Comprehensive ticket configuration state
  const [ticketConfig, setTicketConfig] = useState({
    enabled: false,
    categoryId: null,
    channelId: null, // Channel where the embed will be posted
    supportRoles: [],
    maxTicketsPerUser: 1,
    autoClose: false,
    autoCloseTime: 24,
    requireReason: true,
    logChannelId: null,
    mentionSupport: true,
    dmUser: true,
    embed: {
      title: 'Create a Support Ticket',
      description: 'Click the button below to create a support ticket. Our team will assist you as soon as possible.',
      color: '#5865f2',
      thumbnail: null,
      image: null,
      footer: 'Support System',
      timestamp: true
    },
    buttons: {
      style: 'PRIMARY', // PRIMARY, SECONDARY, SUCCESS, DANGER
      emoji: '🎫',
      label: 'Create Ticket'
    },
    permissions: {
      viewOwnTickets: true,
      allowUserClose: true,
      requireApproval: false
    },
    notifications: {
      onTicketCreate: true,
      onTicketClose: true,
      onTicketMessage: false
    },
    ticketTypes: []
  });
  
  const [activeTickets, setActiveTickets] = useState([]);
  const [closedTickets, setClosedTickets] = useState([]);
  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);
  
  // Ticket type management
  const [newTicketType, setNewTicketType] = useState({
    name: '',
    description: '',
    emoji: '🎫',
    color: '#5865f2',
    categoryId: null,
    maxTickets: 1,
    autoAssignRoles: [],
    questions: [
      { 
        id: Date.now(),
        type: 'text',
        label: 'What can we help you with?',
        placeholder: 'Describe your issue...',
        required: true,
        minLength: 10,
        maxLength: 500
      }
    ],
    permissions: {
      allowedRoles: [],
      deniedRoles: [],
      requireRole: false
    }
  });
  
  const [editingTicketType, setEditingTicketType] = useState(null);
  const [typeDialog, setTypeDialog] = useState({ open: false, mode: 'create' });
  const [transcriptDialog, setTranscriptDialog] = useState({ open: false, ticket: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, id: null });
  const [previewDialog, setPreviewDialog] = useState({ open: false });
  const [embedPreview, setEmbedPreview] = useState(null);

  // Question types for the form builder
  const questionTypes = [
    { value: 'text', label: 'Text Input', icon: '📝' },
    { value: 'textarea', label: 'Long Text', icon: '📄' },
    { value: 'select', label: 'Dropdown', icon: '📋' },
    { value: 'radio', label: 'Multiple Choice', icon: '🔘' },
    { value: 'checkbox', label: 'Checkboxes', icon: '☑️' },
    { value: 'number', label: 'Number', icon: '🔢' },
    { value: 'email', label: 'Email', icon: '📧' },
    { value: 'url', label: 'URL', icon: '🔗' }
  ];

  // Permission checks
  const canManageTickets = hasPermission(user?.role, 'MANAGE_TICKETS');
  const canConfigureTickets = hasPermission(user?.role, 'CONFIGURE_TICKETS');
  const canViewTickets = hasPermission(user?.role, 'VIEW_TICKETS');
  const canCloseTickets = hasPermission(user?.role, 'CLOSE_TICKETS');
  const canExportTickets = hasPermission(user?.role, 'EXPORT_TICKETS');
  const canManageTypes = hasPermission(user?.role, 'MANAGE_TYPES');
  const canViewAnalytics = hasPermission(user?.role, 'VIEW_ANALYTICS');

  const apiRequest = async (url, options = {}) => {
      const baseURL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3000/api';
      const token = localStorage.getItem('authToken');
      
      try {
          const response = await fetch(baseURL + url, {
              ...options,
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': token ? `Bearer ${token}` : '',
                  ...options.headers
              }
          });
          
          // Check if response is JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
              const text = await response.text();
              console.error('Non-JSON response:', text);
              throw new Error('Server returned non-JSON response');
          }
          
          const data = await response.json();
          
          if (!response.ok) {
              throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
          }
          
          return data;
      } catch (error) {
          console.error('API Request Error:', error);
          throw error;
      }
  };


  const loadGuilds = useCallback(async () => {
    try {
      const response = await apiRequest('/guilds');
      setGuilds(response);
      if (response.length > 0 && !selectedGuild) {
        setSelectedGuild(response[0].id);
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
      setGuilds([]);
      toast.error('Failed to load Discord servers');
    }
  }, [selectedGuild]);

  const loadGuildData = useCallback(async (guildId) => {
    if (!guildId) return;
    
    try {
      const response = await apiRequest(`/guild-data/${guildId}`);
      setCategories(response.categories || []);
      setChannels(response.channels || []);
      setRoles(response.roles || []);
    } catch (error) {
      console.error('Failed to load guild data:', error);
      setCategories([]);
      setChannels([]);
      setRoles([]);
      toast.error('Failed to load server data');
    }
  }, []);

  const loadTicketConfig = useCallback(async () => {
    try {
      const response = await apiRequest('/ticket/config');
      const config = response.config || response || {};
      
      setTicketConfig({
        enabled: config.enabled || false,
        categoryId: config.categoryId || null,
        channelId: config.channelId || null,
        supportRoles: config.supportRoles || [],
        maxTicketsPerUser: config.maxTicketsPerUser || 1,
        autoClose: config.autoClose || false,
        autoCloseTime: config.autoCloseTime || 24,
        requireReason: config.requireReason !== false,
        logChannelId: config.logChannelId || null,
        mentionSupport: config.mentionSupport !== false,
        dmUser: config.dmUser !== false,
        embed: {
          title: config.embed?.title || 'Create a Support Ticket',
          description: config.embed?.description || 'Click the button below to create a support ticket. Our team will assist you as soon as possible.',
          color: config.embed?.color || '#5865f2',
          thumbnail: config.embed?.thumbnail || null,
          image: config.embed?.image || null,
          footer: config.embed?.footer || 'Support System',
          timestamp: config.embed?.timestamp !== false
        },
        buttons: {
          style: config.buttons?.style || 'PRIMARY',
          emoji: config.buttons?.emoji || '🎫',
          label: config.buttons?.label || 'Create Ticket'
        },
        permissions: {
          viewOwnTickets: config.permissions?.viewOwnTickets !== false,
          allowUserClose: config.permissions?.allowUserClose !== false,
          requireApproval: config.permissions?.requireApproval || false
        },
        notifications: {
          onTicketCreate: config.notifications?.onTicketCreate !== false,
          onTicketClose: config.notifications?.onTicketClose !== false,
          onTicketMessage: config.notifications?.onTicketMessage || false
        },
        ticketTypes: config.ticketTypes || []
      });
      
      if (response.activeTickets) {
        setActiveTickets(response.activeTickets);
      }
      if (response.closedTickets) {
        setClosedTickets(response.closedTickets);
      }
      
    } catch (error) {
      console.error('Failed to load ticket config:', error);
      toast.error('Failed to load ticket configuration');
    }
  }, []);

  const loadActiveTickets = useCallback(async () => {
    try {
      const response = await apiRequest('/tickets');
      setActiveTickets(response.activeTickets || []);
    } catch (error) {
      console.error('Failed to load active tickets:', error);
      setActiveTickets([]);
    }
  }, []);

  const loadClosedTickets = useCallback(async () => {
    try {
      const response = await apiRequest('/tickets');
      setClosedTickets(response.closedTickets || []);
    } catch (error) {
      console.error('Failed to load closed tickets:', error);
      setClosedTickets([]);
    }
  }, []);

  useEffect(() => {
    if (canViewTickets) {
      setLoading(true);
      Promise.all([
        loadGuilds(),
        loadTicketConfig(),
        loadActiveTickets(),
        loadClosedTickets()
      ]).finally(() => {
        setLoading(false);
      });
    }
  }, [canViewTickets, loadGuilds, loadTicketConfig, loadActiveTickets, loadClosedTickets]);

  useEffect(() => {
    if (selectedGuild && canViewTickets) {
      loadGuildData(selectedGuild);
    }
  }, [selectedGuild, canViewTickets, loadGuildData]);

  useEffect(() => {
    if (socket) {
      socket.on('ticketCreated', (ticket) => {
        setActiveTickets(prev => [ticket, ...prev]);
        toast.success(`New ticket created: ${ticket.typeName || 'Support Ticket'}`);
      });

      socket.on('ticketClosed', (data) => {
        setActiveTickets(prev => prev.filter(ticket => ticket.id !== data.ticketId));
        if (data.closedTicket) {
          setClosedTickets(prev => [data.closedTicket, ...prev]);
        }
        toast.success('Ticket closed and transcript saved');
      });

      return () => {
        socket.off('ticketCreated');
        socket.off('ticketClosed');
      };
    }
  }, [socket]);

  // Save ticket configuration
  const saveTicketConfig = async () => {
    if (!canConfigureTickets) {
      toast.error('You do not have permission to save ticket configuration');
      return;
    }
    
    try {
      setSaving(true);
      await apiRequest('/ticket/config', {
        method: 'POST',
        body: JSON.stringify(ticketConfig)
      });
      toast.success('Ticket configuration saved!');
    } catch (error) {
      console.error('Save config error:', error);
      toast.error('Failed to save configuration: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Deploy ticket embed to channel
  const deployTicketEmbed = async () => {
    if (!ticketConfig.channelId) {
      toast.error('Please select a channel for the ticket embed');
      return;
    }
    
    try {
      setSaving(true);
      await apiRequest('/ticket/deploy', {
        method: 'POST',
        body: JSON.stringify({
          channelId: ticketConfig.channelId,
          embed: ticketConfig.embed,
          buttons: ticketConfig.buttons,
          ticketTypes: ticketConfig.ticketTypes
        })
      });
      toast.success('Ticket embed deployed to channel!');
    } catch (error) {
      toast.error('Failed to deploy embed: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Ticket Type Management
  const addQuestion = () => {
    const newQuestion = {
      id: Date.now(),
      type: 'text',
      label: '',
      placeholder: '',
      required: false,
      options: []
    };
    
    if (editingTicketType) {
      setEditingTicketType(prev => ({
        ...prev,
        questions: [...prev.questions, newQuestion]
      }));
    } else {
      setNewTicketType(prev => ({
        ...prev,
        questions: [...prev.questions, newQuestion]
      }));
    }
  };

  const updateQuestion = (questionId, updates) => {
    const updateQuestions = (questions) => 
      questions.map(q => q.id === questionId ? { ...q, ...updates } : q);
    
    if (editingTicketType) {
      setEditingTicketType(prev => ({
        ...prev,
        questions: updateQuestions(prev.questions)
      }));
    } else {
      setNewTicketType(prev => ({
        ...prev,
        questions: updateQuestions(prev.questions)
      }));
    }
  };

  const removeQuestion = (questionId) => {
    const filterQuestions = (questions) => questions.filter(q => q.id !== questionId);
    
    if (editingTicketType) {
      setEditingTicketType(prev => ({
        ...prev,
        questions: filterQuestions(prev.questions)
      }));
    } else {
      setNewTicketType(prev => ({
        ...prev,
        questions: filterQuestions(prev.questions)
      }));
    }
  };

  const addQuestionOption = (questionId) => {
    const newOption = { id: Date.now(), label: '', value: '' };
    updateQuestion(questionId, {
      options: [...(getCurrentQuestions().find(q => q.id === questionId)?.options || []), newOption]
    });
  };

  const updateQuestionOption = (questionId, optionId, updates) => {
    const question = getCurrentQuestions().find(q => q.id === questionId);
    const updatedOptions = question.options.map(opt => 
      opt.id === optionId ? { ...opt, ...updates } : opt
    );
    updateQuestion(questionId, { options: updatedOptions });
  };

  const removeQuestionOption = (questionId, optionId) => {
    const question = getCurrentQuestions().find(q => q.id === questionId);
    const filteredOptions = question.options.filter(opt => opt.id !== optionId);
    updateQuestion(questionId, { options: filteredOptions });
  };

  const getCurrentQuestions = () => {
    return editingTicketType ? editingTicketType.questions : newTicketType.questions;
  };

  const getCurrentTicketType = () => {
    return editingTicketType || newTicketType;
  };

  const setCurrentTicketType = (updates) => {
    if (editingTicketType) {
      setEditingTicketType(prev => ({ ...prev, ...updates }));
    } else {
      setNewTicketType(prev => ({ ...prev, ...updates }));
    }
  };

  const createTicketType = async () => {
    if (!canManageTypes) {
      toast.error('You do not have permission to create ticket types');
      return;
    }
    
    const typeData = editingTicketType || newTicketType;
    
    if (!typeData.name || typeData.questions.some(q => !q.label)) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      setSaving(true);
      
      if (editingTicketType) {
        await apiRequest(`/ticket/types/${editingTicketType.id}`, {
          method: 'PUT',
          body: JSON.stringify(typeData)
        });
        toast.success('Ticket type updated!');
      } else {
        await apiRequest('/ticket/types', {
          method: 'POST',
          body: JSON.stringify(typeData)
        });
        toast.success('Ticket type created!');
      }
      
      await loadTicketConfig();
      resetTicketTypeForm();
      setTypeDialog({ open: false, mode: 'create' });
    } catch (error) {
      toast.error(error.message || 'Failed to save ticket type');
    } finally {
      setSaving(false);
    }
  };

  const editTicketType = (ticketType) => {
    setEditingTicketType({ ...ticketType });
    setTypeDialog({ open: true, mode: 'edit' });
  };

  const deleteTicketType = async (id) => {
    if (!canManageTypes) {
      toast.error('You do not have permission to delete ticket types');
      return;
    }
    
    try {
      await apiRequest(`/ticket/types/${id}`, { method: 'DELETE' });
      await loadTicketConfig();
      setDeleteDialog({ open: false, type: null, id: null });
      toast.success('Ticket type deleted!');
    } catch (error) {
      toast.error('Failed to delete ticket type');
    }
  };

  const resetTicketTypeForm = () => {
    setNewTicketType({
      name: '',
      description: '',
      emoji: '🎫',
      color: '#5865f2',
      categoryId: null,
      maxTickets: 1,
      autoAssignRoles: [],
      questions: [
        { 
          id: Date.now(),
          type: 'text',
          label: 'What can we help you with?',
          placeholder: 'Describe your issue...',
          required: true,
          minLength: 10,
          maxLength: 500
        }
      ],
      permissions: {
        allowedRoles: [],
        deniedRoles: [],
        requireRole: false
      }
    });
    setEditingTicketType(null);
  };

  // Preview embed
  const generateEmbedPreview = () => {
    const embed = {
      title: ticketConfig.embed.title,
      description: ticketConfig.embed.description,
      color: parseInt(ticketConfig.embed.color.replace('#', ''), 16),
      thumbnail: ticketConfig.embed.thumbnail ? { url: ticketConfig.embed.thumbnail } : null,
      image: ticketConfig.embed.image ? { url: ticketConfig.embed.image } : null,
      footer: ticketConfig.embed.footer ? { text: ticketConfig.embed.footer } : null,
      timestamp: ticketConfig.embed.timestamp ? new Date().toISOString() : null
    };
    
    setEmbedPreview(embed);
    setPreviewDialog({ open: true });
  };

  // Utility functions
  const deleteClosedTicket = async (ticketId) => {
    if (!canExportTickets) {
      toast.error('You do not have permission to delete tickets');
      return;
    }
    
    try {
      await apiRequest(`/ticket/closed/${ticketId}`, { method: 'DELETE' });
      await loadClosedTickets();
      setDeleteDialog({ open: false, type: null, id: null });
      toast.success('Closed ticket deleted!');
    } catch (error) {
      toast.error('Failed to delete closed ticket');
    }
  };

  const viewTranscript = async (ticket) => {
    setTranscriptDialog({ open: true, ticket });
  };

  const exportTicketAsHTML = (ticket) => {
    if (!canExportTickets) {
      toast.error('You do not have permission to export tickets');
      return;
    }
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Ticket Transcript - ${ticket.id}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #5865f2; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .content { margin-top: 20px; }
        .message { margin: 10px 0; padding: 15px; border-left: 3px solid #5865f2; background: #f8f9fa; border-radius: 4px; }
        .meta { color: #666; font-size: 0.9em; margin-bottom: 10px; }
        .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
        .status.open { background: #28a745; color: white; }
        .status.closed { background: #6c757d; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎫 Ticket Transcript</h1>
            <p><strong>Ticket ID:</strong> ${ticket.id}</p>
            <p><strong>Created:</strong> ${new Date(ticket.createdAt).toLocaleString()}</p>
            ${ticket.closedAt ? `<p><strong>Closed:</strong> ${new Date(ticket.closedAt).toLocaleString()}</p>` : ''}
        </div>
        <div class="content">
            <h2>Ticket Details</h2>
            <div class="meta">
                <p><strong>User:</strong> ${ticket.username}</p>
                <p><strong>Subject:</strong> ${ticket.subject || 'No subject'}</p>
                <p><strong>Type:</strong> ${ticket.typeName || 'General Support'}</p>
                <p><strong>Priority:</strong> ${ticket.priority || 'Normal'}</p>
                <p><strong>Status:</strong> <span class="status ${ticket.status}">${ticket.status}</span></p>
                ${ticket.closeReason ? `<p><strong>Close Reason:</strong> ${ticket.closeReason}</p>` : ''}
                ${ticket.closedBy ? `<p><strong>Closed By:</strong> ${ticket.closedBy}</p>` : ''}
            </div>
            
            ${ticket.responses ? `
            <h3>User Responses</h3>
            ${ticket.responses.map(response => `
                <div class="message">
                    <strong>${response.question}:</strong><br>
                    ${response.answer}
                </div>
            `).join('')}
            ` : ''}
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em;">
                <p>This transcript was generated on ${new Date().toLocaleString()}</p>
                <p>Ticket System - Discord Bot Dashboard</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticket-${ticket.id}-transcript.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Ticket transcript exported!');
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'open': return 'success';
      case 'waiting': return 'warning';
      case 'closed': return 'default';
      case 'escalated': return 'error';
      default: return 'primary';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'urgent': return 'error';
      default: return 'default';
    }
  };

  if (!canViewTickets) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            You do not have permission to view the ticket system.
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
            <TicketIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Advanced Ticket System
          </Typography>
          
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton onClick={loadTicketConfig} color="primary" size="small">
              <RefreshIcon />
            </IconButton>
            <Chip 
              label={`${activeTickets.length} Active`} 
              color="primary"
              size="small"
            />
            <Chip 
              label={`${closedTickets.length} Closed`} 
              color="default"
              size="small"
            />
            <Chip 
              label={`${ticketConfig.ticketTypes.length} Types`} 
              color="secondary"
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
          <Tab label="Configuration" disabled={!canConfigureTickets} />
          <Tab label="Ticket Types" disabled={!canManageTypes} />
          <Tab label="Active Tickets" />
          <Tab label="Closed Tickets" />
          {canViewAnalytics && <Tab label="Analytics" />}
        </Tabs>

        <Box sx={{ mt: 3 }}>
          {/* Configuration Tab */}
          {tabValue === 0 && canConfigureTickets && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Grid container spacing={3}>
                {/* Basic Settings */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6">
                        <SettingsIcon sx={{ mr: 1 }} />
                        Basic Settings
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={ticketConfig.enabled}
                                onChange={(e) => setTicketConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                              />
                            }
                            label="Enable Ticket System"
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth>
                            <InputLabel>Ticket Category</InputLabel>
                            <Select
                              value={ticketConfig.categoryId || ''}
                              onChange={(e) => setTicketConfig(prev => ({ ...prev, categoryId: e.target.value }))}
                            >
                              {categories.map(category => (
                                <MenuItem key={category.id} value={category.id}>
                                  <CategoryIcon sx={{ mr: 1 }} />
                                  {category.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth>
                            <InputLabel>Embed Channel</InputLabel>
                            <Select
                              value={ticketConfig.channelId || ''}
                              onChange={(e) => setTicketConfig(prev => ({ ...prev, channelId: e.target.value }))}
                            >
                              {channels.filter(ch => ch.type === 0).map(channel => (
                                <MenuItem key={channel.id} value={channel.id}>
                                  <ChannelIcon sx={{ mr: 1 }} />
                                  # {channel.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth>
                            <InputLabel>Log Channel</InputLabel>
                            <Select
                              value={ticketConfig.logChannelId || ''}
                              onChange={(e) => setTicketConfig(prev => ({ ...prev, logChannelId: e.target.value }))}
                            >
                              <MenuItem value="">
                                <em>None</em>
                              </MenuItem>
                              {channels.filter(ch => ch.type === 0).map(channel => (
                                <MenuItem key={channel.id} value={channel.id}>
                                  <ChannelIcon sx={{ mr: 1 }} />
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
                            label="Max Tickets Per User"
                            value={ticketConfig.maxTicketsPerUser}
                            onChange={(e) => setTicketConfig(prev => ({ 
                              ...prev, 
                              maxTicketsPerUser: parseInt(e.target.value) || 1 
                            }))}
                            inputProps={{ min: 1, max: 10 }}
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <FormControl fullWidth>
                            <InputLabel>Support Roles</InputLabel>
                            <Select
                              multiple
                              value={ticketConfig.supportRoles || []}
                              onChange={(e) => setTicketConfig(prev => ({ 
                                ...prev, 
                                supportRoles: e.target.value 
                              }))}
                            >
                              {roles.map(role => (
                                <MenuItem key={role.id} value={role.id}>
                                  <GroupIcon sx={{ mr: 1 }} />
                                  {role.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* Embed Customization */}
                <Grid item xs={12}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6">
                        <PaletteIcon sx={{ mr: 1 }} />
                        Embed Customization
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Embed Title"
                            value={ticketConfig.embed.title}
                            onChange={(e) => setTicketConfig(prev => ({
                              ...prev,
                              embed: { ...prev.embed, title: e.target.value }
                            }))}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="color"
                            label="Embed Color"
                            value={ticketConfig.embed.color}
                            onChange={(e) => setTicketConfig(prev => ({
                              ...prev,
                              embed: { ...prev.embed, color: e.target.value }
                            }))}
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Embed Description"
                            value={ticketConfig.embed.description}
                            onChange={(e) => setTicketConfig(prev => ({
                              ...prev,
                              embed: { ...prev.embed, description: e.target.value }
                            }))}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Thumbnail URL"
                            value={ticketConfig.embed.thumbnail || ''}
                            onChange={(e) => setTicketConfig(prev => ({
                              ...prev,
                              embed: { ...prev.embed, thumbnail: e.target.value }
                            }))}
                            placeholder="https://example.com/image.png"
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Image URL"
                            value={ticketConfig.embed.image || ''}
                            onChange={(e) => setTicketConfig(prev => ({
                              ...prev,
                              embed: { ...prev.embed, image: e.target.value }
                            }))}
                            placeholder="https://example.com/image.png"
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Footer Text"
                            value={ticketConfig.embed.footer}
                            onChange={(e) => setTicketConfig(prev => ({
                              ...prev,
                              embed: { ...prev.embed, footer: e.target.value }
                            }))}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={ticketConfig.embed.timestamp}
                                onChange={(e) => setTicketConfig(prev => ({
                                  ...prev,
                                  embed: { ...prev.embed, timestamp: e.target.checked }
                                }))}
                              />
                            }
                            label="Show Timestamp"
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <Button
                            variant="outlined"
                            startIcon={<PreviewIcon />}
                            onClick={generateEmbedPreview}
                          >
                            Preview Embed
                          </Button>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* Button Customization */}
                <Grid item xs={12}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6">
                        Button Settings
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                          <FormControl fullWidth>
                            <InputLabel>Button Style</InputLabel>
                            <Select
                              value={ticketConfig.buttons.style}
                              onChange={(e) => setTicketConfig(prev => ({
                                ...prev,
                                buttons: { ...prev.buttons, style: e.target.value }
                              }))}
                            >
                              <MenuItem value="PRIMARY">Primary (Blue)</MenuItem>
                              <MenuItem value="SECONDARY">Secondary (Gray)</MenuItem>
                              <MenuItem value="SUCCESS">Success (Green)</MenuItem>
                              <MenuItem value="DANGER">Danger (Red)</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            label="Button Label"
                            value={ticketConfig.buttons.label}
                            onChange={(e) => setTicketConfig(prev => ({
                              ...prev,
                              buttons: { ...prev.buttons, label: e.target.value }
                            }))}
                          />
                        </Grid>

                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            label="Button Emoji"
                            value={ticketConfig.buttons.emoji}
                            onChange={(e) => setTicketConfig(prev => ({
                              ...prev,
                              buttons: { ...prev.buttons, emoji: e.target.value }
                            }))}
                            placeholder="🎫"
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* Advanced Settings */}
                <Grid item xs={12}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="h6">
                        <AutoIcon sx={{ mr: 1 }} />
                        Advanced Settings
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={ticketConfig.autoClose}
                                onChange={(e) => setTicketConfig(prev => ({ ...prev, autoClose: e.target.checked }))}
                              />
                            }
                            label="Auto-close inactive tickets"
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Auto-close after (hours)"
                            value={ticketConfig.autoCloseTime}
                            onChange={(e) => setTicketConfig(prev => ({ 
                              ...prev, 
                              autoCloseTime: parseInt(e.target.value) || 24 
                            }))}
                            disabled={!ticketConfig.autoClose}
                            inputProps={{ min: 1, max: 168 }}
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={ticketConfig.requireReason}
                                onChange={(e) => setTicketConfig(prev => ({ ...prev, requireReason: e.target.checked }))}
                              />
                            }
                            label="Require close reason"
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={ticketConfig.mentionSupport}
                                onChange={(e) => setTicketConfig(prev => ({ ...prev, mentionSupport: e.target.checked }))}
                              />
                            }
                            label="Mention support on ticket creation"
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={ticketConfig.dmUser}
                                onChange={(e) => setTicketConfig(prev => ({ ...prev, dmUser: e.target.checked }))}
                              />
                            }
                            label="DM user on ticket events"
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={ticketConfig.permissions.allowUserClose}
                                onChange={(e) => setTicketConfig(prev => ({
                                  ...prev,
                                  permissions: { ...prev.permissions, allowUserClose: e.target.checked }
                                }))}
                              />
                            }
                            label="Allow users to close own tickets"
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* Save and Deploy */}
                <Grid item xs={12}>
                  <Box display="flex" gap={2}>
                    <Button
                      variant="contained"
                      onClick={saveTicketConfig}
                      disabled={saving}
                      startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                    >
                      {saving ? 'Saving...' : 'Save Configuration'}
                    </Button>
                    
                    <Button
                      variant="outlined"
                      onClick={deployTicketEmbed}
                      disabled={saving || !ticketConfig.channelId}
                      startIcon={<SendIcon />}
                    >
                      Deploy Embed to Channel
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </motion.div>
          )}

          {/* Ticket Types Tab */}
          {tabValue === 1 && canManageTypes && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6">
                  <QuestionIcon sx={{ mr: 1 }} />
                  Ticket Types & Forms
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    resetTicketTypeForm();
                    setTypeDialog({ open: true, mode: 'create' });
                  }}
                >
                  Create Ticket Type
                </Button>
              </Box>

              {ticketConfig.ticketTypes.length === 0 ? (
                <Alert severity="info">
                  No ticket types configured. Create your first ticket type to get started!
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  {ticketConfig.ticketTypes.map((ticketType) => (
                    <Grid item xs={12} sm={6} md={4} key={ticketType.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box display="flex" alignItems="center" mb={2}>
                            <Typography variant="h4" sx={{ mr: 1 }}>
                              {ticketType.emoji}
                            </Typography>
                            <Box>
                              <Typography variant="h6">{ticketType.name}</Typography>
                              <Typography variant="body2" color="textSecondary">
                                {ticketType.description}
                              </Typography>
                            </Box>
                          </Box>
                          
                          <Box display="flex" gap={1} mb={2}>
                            <Chip 
                              label={`${ticketType.questions.length} questions`} 
                              size="small" 
                              color="primary"
                            />
                            <Chip 
                              label={`Max: ${ticketType.maxTickets}`} 
                              size="small" 
                              color="secondary"
                            />
                          </Box>
                          
                          <Box display="flex" gap={1}>
                            <IconButton
                              size="small"
                              onClick={() => editTicketType(ticketType)}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteDialog({ 
                                open: true, 
                                type: 'ticketType', 
                                id: ticketType.id 
                              })}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </motion.div>
          )}

          {/* Active Tickets Tab */}
          {tabValue === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6">
                  Active Tickets ({activeTickets.length})
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadActiveTickets}
                >
                  Refresh
                </Button>
              </Box>

              {activeTickets.length === 0 ? (
                <Alert severity="info">
                  No active tickets at the moment. Great job keeping up with support!
                </Alert>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Ticket ID</TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Subject</TableCell>
                        <TableCell>Priority</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Last Activity</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeTickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {ticket.id}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <Avatar sx={{ width: 24, height: 24, mr: 1 }}>
                                {ticket.username.charAt(0).toUpperCase()}
                              </Avatar>
                              {ticket.username}
                            </Box>
                          </TableCell>
                          <TableCell>{ticket.typeName || 'General'}</TableCell>
                          <TableCell>{ticket.subject || 'No subject'}</TableCell>
                          <TableCell>
                            <Chip 
                              label={ticket.priority || 'Normal'} 
                              color={getPriorityColor(ticket.priority)}
                              size="small" 
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={ticket.status || 'Open'} 
                              color={getStatusColor(ticket.status)}
                              size="small" 
                            />
                          </TableCell>
                          <TableCell>{formatTime(ticket.createdAt)}</TableCell>
                          <TableCell>{formatTime(ticket.lastActivity || ticket.createdAt)}</TableCell>
                          <TableCell>
                            <Box display="flex" gap={1}>
                              <Tooltip title="View Details">
                                <IconButton 
                                  size="small" 
                                  onClick={() => viewTranscript(ticket)}
                                >
                                  <ViewIcon />
                                </IconButton>
                              </Tooltip>
                              {canCloseTickets && (
                                <Tooltip title="Close Ticket">
                                  <IconButton 
                                    size="small" 
                                    color="warning"
                                    onClick={() => setDeleteDialog({ 
                                      open: true, 
                                      type: 'closeTicket', 
                                      id: ticket.id 
                                    })}
                                  >
                                    <LockIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </motion.div>
          )}

          {/* Closed Tickets Tab */}
          {tabValue === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6">
                  Closed Tickets ({closedTickets.length})
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadClosedTickets}
                >
                  Refresh
                </Button>
              </Box>

              {closedTickets.length === 0 ? (
                <Alert severity="info">
                  No closed tickets found. Closed tickets will appear here for review and export.
                </Alert>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Ticket ID</TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Subject</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Closed</TableCell>
                        <TableCell>Closed By</TableCell>
                        <TableCell>Duration</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {closedTickets.map((ticket) => {
                        const duration = ticket.closedAt ? 
                          Math.round((new Date(ticket.closedAt) - new Date(ticket.createdAt)) / (1000 * 60 * 60)) : 0;
                        
                        return (
                          <TableRow key={ticket.id}>
                            <TableCell>
                              <Typography variant="body2" fontFamily="monospace">
                                {ticket.id}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center">
                                <Avatar sx={{ width: 24, height: 24, mr: 1 }}>
                                  {ticket.username.charAt(0).toUpperCase()}
                                </Avatar>
                                {ticket.username}
                              </Box>
                            </TableCell>
                            <TableCell>{ticket.typeName || 'General'}</TableCell>
                            <TableCell>{ticket.subject || 'No subject'}</TableCell>
                            <TableCell>{formatTime(ticket.createdAt)}</TableCell>
                            <TableCell>{formatTime(ticket.closedAt)}</TableCell>
                            <TableCell>{ticket.closedBy || 'Unknown'}</TableCell>
                            <TableCell>{duration}h</TableCell>
                            <TableCell>
                              <Box display="flex" gap={1}>
                                <Tooltip title="View Transcript">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => viewTranscript(ticket)}
                                  >
                                    <ViewIcon />
                                  </IconButton>
                                </Tooltip>
                                {canExportTickets && (
                                  <>
                                    <Tooltip title="Export HTML">
                                      <IconButton 
                                        size="small" 
                                        color="primary"
                                        onClick={() => exportTicketAsHTML(ticket)}
                                      >
                                        <DownloadIcon />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete Ticket">
                                      <IconButton 
                                        size="small" 
                                        color="error"
                                        onClick={() => setDeleteDialog({ 
                                          open: true, 
                                          type: 'closedTicket', 
                                          id: ticket.id 
                                        })}
                                      >
                                        <DeleteIcon />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </motion.div>
          )}

          {/* Analytics Tab */}
          {tabValue === 4 && canViewAnalytics && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Typography variant="h6" gutterBottom>
                Ticket Analytics
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Total Tickets
                      </Typography>
                      <Typography variant="h4">
                        {activeTickets.length + closedTickets.length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Active Tickets
                      </Typography>
                      <Typography variant="h4" color="primary">
                        {activeTickets.length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Avg. Resolution Time
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        {closedTickets.length > 0 ? 
                          Math.round(closedTickets.reduce((sum, ticket) => {
                            const duration = ticket.closedAt ? 
                              (new Date(ticket.closedAt) - new Date(ticket.createdAt)) / (1000 * 60 * 60) : 0;
                            return sum + duration;
                          }, 0) / closedTickets.length) : 0
                        }h
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Ticket Types
                      </Typography>
                      <Typography variant="h4" color="secondary">
                        {ticketConfig.ticketTypes.length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </motion.div>
          )}
        </Box>
      </CardContent>

      {/* Ticket Type Dialog */}
      <Dialog
        open={typeDialog.open}
        onClose={() => {
          setTypeDialog({ open: false, mode: 'create' });
          resetTicketTypeForm();
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {typeDialog.mode === 'edit' ? 'Edit Ticket Type' : 'Create Ticket Type'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Basic Info */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Type Name"
                value={getCurrentTicketType().name}
                onChange={(e) => setCurrentTicketType({ name: e.target.value })}
                placeholder="Bug Report"
              />
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Emoji"
                value={getCurrentTicketType().emoji}
                onChange={(e) => setCurrentTicketType({ emoji: e.target.value })}
                placeholder="🐛"
              />
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                type="color"
                label="Color"
                value={getCurrentTicketType().color}
                onChange={(e) => setCurrentTicketType({ color: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description"
                value={getCurrentTicketType().description}
                onChange={(e) => setCurrentTicketType({ description: e.target.value })}
                placeholder="Report bugs and technical issues"
              />
            </Grid>

            {/* Settings */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Category Override</InputLabel>
                <Select
                  value={getCurrentTicketType().categoryId || ''}
                  onChange={(e) => setCurrentTicketType({ categoryId: e.target.value })}
                >
                  <MenuItem value="">
                    <em>Use default category</em>
                  </MenuItem>
                  {categories.map(category => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Tickets Per User"
                value={getCurrentTicketType().maxTickets}
                onChange={(e) => setCurrentTicketType({ maxTickets: parseInt(e.target.value) || 1 })}
                inputProps={{ min: 1, max: 10 }}
              />
            </Grid>

            {/* Questions Builder */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                <QuestionIcon sx={{ mr: 1 }} />
                Form Questions
              </Typography>
              
              {getCurrentQuestions().map((question, index) => (
                <Card key={question.id} variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="subtitle1">
                        Question {index + 1}
                      </Typography>
                      <Box>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeQuestion(question.id)}
                          disabled={getCurrentQuestions().length === 1}
                        >
                          <DeleteIcon />
                                                  </IconButton>
                      </Box>
                    </Box>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Question Type</InputLabel>
                          <Select
                            value={question.type}
                            onChange={(e) => updateQuestion(question.id, { type: e.target.value })}
                          >
                            {questionTypes.map(type => (
                              <MenuItem key={type.value} value={type.value}>
                                {type.icon} {type.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={question.required}
                              onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                            />
                          }
                          label="Required"
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Question Label"
                          value={question.label}
                          onChange={(e) => updateQuestion(question.id, { label: e.target.value })}
                          placeholder="What is your issue?"
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Placeholder Text"
                          value={question.placeholder}
                          onChange={(e) => updateQuestion(question.id, { placeholder: e.target.value })}
                          placeholder="Describe your issue in detail..."
                        />
                      </Grid>
                      
                      {(question.type === 'text' || question.type === 'textarea') && (
                        <>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Min Length"
                              value={question.minLength || ''}
                              onChange={(e) => updateQuestion(question.id, { minLength: parseInt(e.target.value) || 0 })}
                              inputProps={{ min: 0 }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Max Length"
                              value={question.maxLength || ''}
                              onChange={(e) => updateQuestion(question.id, { maxLength: parseInt(e.target.value) || 1000 })}
                              inputProps={{ min: 1 }}
                            />
                          </Grid>
                        </>
                      )}
                      
                      {(question.type === 'select' || question.type === 'radio' || question.type === 'checkbox') && (
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" gutterBottom>
                            Options
                          </Typography>
                          {(question.options || []).map((option, optIndex) => (
                            <Box key={option.id} display="flex" gap={1} mb={1}>
                              <TextField
                                size="small"
                                label="Label"
                                value={option.label}
                                onChange={(e) => updateQuestionOption(question.id, option.id, { label: e.target.value })}
                                placeholder="Option label"
                              />
                              <TextField
                                size="small"
                                label="Value"
                                value={option.value}
                                onChange={(e) => updateQuestionOption(question.id, option.id, { value: e.target.value })}
                                placeholder="option_value"
                              />
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => removeQuestionOption(question.id, option.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Box>
                          ))}
                          <Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => addQuestionOption(question.id)}
                          >
                            Add Option
                          </Button>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              ))}
              
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addQuestion}
                sx={{ mb: 2 }}
              >
                Add Question
              </Button>
            </Grid>

            {/* Auto-assign Roles */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Auto-assign Roles</InputLabel>
                <Select
                  multiple
                  value={getCurrentTicketType().autoAssignRoles || []}
                  onChange={(e) => setCurrentTicketType({ autoAssignRoles: e.target.value })}
                >
                  {roles.map(role => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Permissions */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Permissions
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Allowed Roles</InputLabel>
                    <Select
                      multiple
                      value={getCurrentTicketType().permissions?.allowedRoles || []}
                      onChange={(e) => setCurrentTicketType({
                        permissions: {
                          ...getCurrentTicketType().permissions,
                          allowedRoles: e.target.value
                        }
                      })}
                    >
                      {roles.map(role => (
                        <MenuItem key={role.id} value={role.id}>
                          {role.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Denied Roles</InputLabel>
                    <Select
                      multiple
                      value={getCurrentTicketType().permissions?.deniedRoles || []}
                      onChange={(e) => setCurrentTicketType({
                        permissions: {
                          ...getCurrentTicketType().permissions,
                          deniedRoles: e.target.value
                        }
                      })}
                    >
                      {roles.map(role => (
                        <MenuItem key={role.id} value={role.id}>
                          {role.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={getCurrentTicketType().permissions?.requireRole || false}
                        onChange={(e) => setCurrentTicketType({
                          permissions: {
                            ...getCurrentTicketType().permissions,
                            requireRole: e.target.checked
                          }
                        })}
                      />
                    }
                    label="Require specific role to use this ticket type"
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setTypeDialog({ open: false, mode: 'create' });
              resetTicketTypeForm();
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={createTicketType}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            {saving ? 'Saving...' : (typeDialog.mode === 'edit' ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Embed Preview Dialog */}
      <Dialog
        open={previewDialog.open}
        onClose={() => setPreviewDialog({ open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Embed Preview</DialogTitle>
        <DialogContent>
          {embedPreview && (
            <Paper
              sx={{
                p: 2,
                backgroundColor: '#36393f',
                color: 'white',
                borderLeft: `4px solid ${ticketConfig.embed.color}`,
                fontFamily: 'Whitney, "Helvetica Neue", Helvetica, Arial, sans-serif'
              }}
            >
              {ticketConfig.embed.thumbnail && (
                <Box display="flex" justifyContent="flex-end" mb={1}>
                  <img
                    src={ticketConfig.embed.thumbnail}
                    alt="Thumbnail"
                    style={{ width: 80, height: 80, borderRadius: 4 }}
                  />
                </Box>
              )}
              
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>
                {ticketConfig.embed.title}
              </Typography>
              
              <Typography variant="body2" sx={{ color: '#dcddde', mb: 2 }}>
                {ticketConfig.embed.description}
              </Typography>
              
              {ticketConfig.embed.image && (
                <Box mb={2}>
                  <img
                    src={ticketConfig.embed.image}
                    alt="Embed"
                    style={{ maxWidth: '100%', borderRadius: 4 }}
                  />
                </Box>
              )}
              
              <Box display="flex" justifyContent="space-between" alignItems="center">
                {ticketConfig.embed.footer && (
                  <Typography variant="caption" sx={{ color: '#72767d' }}>
                    {ticketConfig.embed.footer}
                  </Typography>
                )}
                {ticketConfig.embed.timestamp && (
                  <Typography variant="caption" sx={{ color: '#72767d' }}>
                    {new Date().toLocaleString()}
                  </Typography>
                )}
              </Box>
              
              <Box mt={2}>
                <Button
                  variant="contained"
                  sx={{
                    backgroundColor: ticketConfig.buttons.style === 'PRIMARY' ? '#5865f2' :
                                   ticketConfig.buttons.style === 'SUCCESS' ? '#57f287' :
                                   ticketConfig.buttons.style === 'DANGER' ? '#ed4245' : '#4f545c',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: ticketConfig.buttons.style === 'PRIMARY' ? '#4752c4' :
                                     ticketConfig.buttons.style === 'SUCCESS' ? '#3ba55d' :
                                     ticketConfig.buttons.style === 'DANGER' ? '#c23616' : '#3c4043'
                    }
                  }}
                  startIcon={<span>{ticketConfig.buttons.emoji}</span>}
                >
                  {ticketConfig.buttons.label}
                </Button>
              </Box>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog({ open: false })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transcript Dialog */}
      <Dialog
        open={transcriptDialog.open}
        onClose={() => setTranscriptDialog({ open: false, ticket: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon />
            Ticket Transcript - {transcriptDialog.ticket?.id}
          </Box>
        </DialogTitle>
        <DialogContent>
          {transcriptDialog.ticket && (
            <Box>
              <Grid container spacing={2} mb={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="h6" gutterBottom>
                    Ticket Details
                  </Typography>
                  <Typography><strong>ID:</strong> {transcriptDialog.ticket.id}</Typography>
                  <Typography><strong>User:</strong> {transcriptDialog.ticket.username}</Typography>
                  <Typography><strong>Type:</strong> {transcriptDialog.ticket.typeName || 'General'}</Typography>
                  <Typography><strong>Subject:</strong> {transcriptDialog.ticket.subject || 'No subject'}</Typography>
                  <Typography><strong>Priority:</strong> {transcriptDialog.ticket.priority || 'Normal'}</Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="h6" gutterBottom>
                    Timeline
                  </Typography>
                  <Typography><strong>Created:</strong> {formatTime(transcriptDialog.ticket.createdAt)}</Typography>
                  <Typography><strong>Last Activity:</strong> {formatTime(transcriptDialog.ticket.lastActivity || transcriptDialog.ticket.createdAt)}</Typography>
                  {transcriptDialog.ticket.closedAt && (
                    <>
                      <Typography><strong>Closed:</strong> {formatTime(transcriptDialog.ticket.closedAt)}</Typography>
                      <Typography><strong>Closed By:</strong> {transcriptDialog.ticket.closedBy}</Typography>
                      <Typography><strong>Close Reason:</strong> {transcriptDialog.ticket.closeReason || 'No reason provided'}</Typography>
                    </>
                  )}
                </Grid>
              </Grid>
              
              {transcriptDialog.ticket.responses && transcriptDialog.ticket.responses.length > 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    User Responses
                  </Typography>
                  {transcriptDialog.ticket.responses.map((response, index) => (
                    <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                      <CardContent>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                          {response.question}
                        </Typography>
                        <Typography variant="body2">
                          {response.answer}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
              
              {transcriptDialog.ticket.messages && transcriptDialog.ticket.messages.length > 0 && (
                <Box mt={3}>
                  <Typography variant="h6" gutterBottom>
                    Message History
                  </Typography>
                  <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {transcriptDialog.ticket.messages.map((message, index) => (
                      <Box key={index} mb={2} p={2} sx={{ backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {message.author}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {formatTime(message.timestamp)}
                          </Typography>
                        </Box>
                        <Typography variant="body2">
                          {message.content}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTranscriptDialog({ open: false, ticket: null })}>
            Close
          </Button>
          {canExportTickets && transcriptDialog.ticket && (
            <Button 
              variant="contained" 
              onClick={() => exportTicketAsHTML(transcriptDialog.ticket)}
              startIcon={<DownloadIcon />}
            >
              Export HTML
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, type: null, id: null })}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="warning" />
            Confirm Action
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>
            {deleteDialog.type === 'ticketType' && 'Are you sure you want to delete this ticket type? This action cannot be undone.'}
            {deleteDialog.type === 'closedTicket' && 'Are you sure you want to permanently delete this closed ticket? This action cannot be undone.'}
            {deleteDialog.type === 'closeTicket' && 'Are you sure you want to close this ticket? The ticket will be moved to closed tickets.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, type: null, id: null })}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color={deleteDialog.type === 'closeTicket' ? 'warning' : 'error'}
            onClick={() => {
              if (deleteDialog.type === 'ticketType') {
                deleteTicketType(deleteDialog.id);
              } else if (deleteDialog.type === 'closedTicket') {
                deleteClosedTicket(deleteDialog.id);
              } else if (deleteDialog.type === 'closeTicket') {
                // Close ticket logic would go here
                toast.success('Ticket close functionality coming soon!');
                setDeleteDialog({ open: false, type: null, id: null });
              }
            }}
          >
            {deleteDialog.type === 'closeTicket' ? 'Close Ticket' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default TicketPanel;
