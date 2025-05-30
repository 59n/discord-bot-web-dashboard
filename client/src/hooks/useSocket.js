import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('Initializing socket connection...');
    
    const socketURL = process.env.NODE_ENV === 'production' 
      ? window.location.origin 
      : 'http://localhost:3000';
    
    const newSocket = io(socketURL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      autoConnect: true
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to bot server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from bot server:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('botStatus', (stats) => {
      console.log('📊 Received bot stats:', stats);
      setIsConnected(stats.status === 'online');
    });

    setSocket(newSocket);

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up socket connection');
      if (newSocket) {
        newSocket.removeAllListeners();
        newSocket.close();
      }
    };
  }, []);

  // Add cleanup on page unload to prevent Firefox warnings
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socket) {
        socket.close();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [socket]);

  return { socket, isConnected };
};

export default useSocket;
