export const PERMISSIONS = {
  // Command Builder
  CREATE_COMMANDS: ['admin', 'moderator'],
  DELETE_COMMANDS: ['admin'],
  VIEW_COMMANDS: ['admin', 'moderator', 'viewer'],
  REFRESH_SLASH: ['admin', 'moderator'],
  VIEW_LOGS: ['admin', 'moderator', 'viewer'],
  
  // Ticket System
  MANAGE_TICKETS: ['admin', 'moderator'],
  CONFIGURE_TICKETS: ['admin'],
  VIEW_TICKETS: ['admin', 'moderator', 'viewer'],
  CLOSE_TICKETS: ['admin', 'moderator'],
  EXPORT_TICKETS: ['admin', 'moderator'],
  
  // Bot Controls
  CHANGE_STATUS: ['admin', 'moderator'],
  VIEW_STATS: ['admin', 'moderator', 'viewer'],
  
  // Security
  MANAGE_SECURITY: ['admin'],
  MANAGE_USERS: ['admin']
};

export const hasPermission = (userRole, permission) => {
  return PERMISSIONS[permission]?.includes(userRole) || false;
};

export const canAccessComponent = (userRole, component) => {
  const componentPermissions = {
    'CommandBuilder': ['admin', 'moderator'], // Admin should have access
    'TicketPanel': ['admin', 'moderator', 'viewer'], // All roles can access
    'SecurityPanel': ['admin'], // Admin only
    'BotStats': ['admin', 'moderator', 'viewer'] // All roles
  };
  
  return componentPermissions[component]?.includes(userRole) || false;
};


export const getRoleDescription = (role) => {
  const descriptions = {
    'admin': 'Full access to all features including security management',
    'moderator': 'Can manage tickets and commands but cannot access security settings',
    'viewer': 'Read-only access to view statistics and tickets'
  };
  
  return descriptions[role] || 'Unknown role';
};
