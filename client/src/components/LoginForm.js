import React, { useState } from 'react';
import {
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Box,
  Alert
} from '@mui/material';
import { Security as SecurityIcon } from '@mui/icons-material';
import { setAuthToken } from '../utils/auth';
import toast from 'react-hot-toast';

const LoginForm = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ username: 'admin', password: 'admin123' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      if (response.ok) {
        const data = await response.json();
        setAuthToken(data.token);
        toast.success('Login successful!');
        onLogin(data.user);
      } else {
        const error = await response.json();
        setError(error.message);
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
    
    setLoading(false);
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent>
          <Box textAlign="center" mb={3}>
            <SecurityIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" gutterBottom>
              Security Dashboard
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Please login to continue
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Username"
              value={credentials.username}
              onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              type="password"
              label="Password"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              margin="normal"
              required
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3 }}
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <Alert severity="info" sx={{ mt: 2 }}>
            <strong>Default credentials:</strong><br />
            Username: admin<br />
            Password: admin123
          </Alert>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginForm;
