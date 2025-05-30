import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
  Chip
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

const MessageLog = ({ messages }) => {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Card sx={{ height: 600 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Live Messages
        </Typography>
        
        <Box 
          sx={{ 
            height: 520, 
            overflow: 'auto',
            '&::-webkit-scrollbar': {
              width: 8,
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 4,
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#5865f2',
              borderRadius: 4,
            },
          }}
        >
          <AnimatePresence>
            {messages.map((msg, index) => (
              <motion.div
                key={msg.id || index}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Box 
                  sx={{ 
                    mb: 2, 
                    p: 2, 
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <Box display="flex" alignItems="center" mb={1}>
                    <Avatar 
                      src={msg.authorAvatar} 
                      sx={{ width: 24, height: 24, mr: 1 }}
                    />
                    <Typography variant="subtitle2" color="primary">
                      {msg.author}
                    </Typography>
                    <Chip 
                      label={msg.guild} 
                      size="small" 
                      sx={{ ml: 1, height: 20 }}
                    />
                    <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.7 }}>
                      {formatTime(msg.timestamp)}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    #{msg.channel}
                  </Typography>
                  
                  <Typography variant="body2">
                    {msg.content}
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {messages.length === 0 && (
            <Box 
              display="flex" 
              justifyContent="center" 
              alignItems="center" 
              height="100%"
            >
              <Typography variant="body2" color="textSecondary">
                No messages yet...
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default MessageLog;
