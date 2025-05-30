import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Avatar,
  Chip
} from '@mui/material';

const Navbar = ({ botStats, connected }) => {
  return (
    <AppBar position="static" sx={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)' }}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Discord Bot Controller
        </Typography>
        
        <Box display="flex" alignItems="center" gap={2}>
          <Chip
            icon={<div style={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              backgroundColor: connected ? '#4CAF50' : '#f44336' 
            }} />}
            label={connected ? 'Connected' : 'Disconnected'}
            variant="outlined"
            size="small"
          />
          
          {botStats.username && (
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar 
                src={botStats.avatar} 
                sx={{ width: 32, height: 32 }}
              />
              <Typography variant="body2">
                {botStats.username}
              </Typography>
            </Box>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
