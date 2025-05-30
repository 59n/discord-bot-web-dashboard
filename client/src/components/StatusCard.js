import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { motion } from 'framer-motion';

const StatusCard = ({ title, value, icon, color }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Card 
        sx={{ 
          height: '100%',
          background: `linear-gradient(135deg, ${
            color === 'primary' ? '#5865f2, #7289da' :
            color === 'secondary' ? '#eb459e, #fd79a8' :
            color === 'success' ? '#43a047, #66bb6a' :
            color === 'error' ? '#e53935, #ef5350' :
            '#667eea, #764ba2'
          })`,
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography color="textSecondary" gutterBottom variant="h6">
                {title}
              </Typography>
              <Typography variant="h4" component="div" fontWeight="bold">
                {value}
              </Typography>
            </Box>
            <Typography variant="h2">
              {icon}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StatusCard;
