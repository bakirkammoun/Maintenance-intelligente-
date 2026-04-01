import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import websocket from '../services/websocket';

const WebSocketContext = createContext();

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within WebSocketProvider');
    }
    return context;
};

export const WebSocketProvider = ({ children }) => {
    const { user } = useAuth();
    const isConnectedRef = useRef(false);

    useEffect(() => {
        // ✅ OPTIMISATION: Connexion unique pour toute l'application
        if (user && !isConnectedRef.current) {
            websocket.connect();
            isConnectedRef.current = true;
            console.log('WebSocket connected globally');
        }

        // Déconnexion seulement au logout
        return () => {
            if (!user && isConnectedRef.current) {
                websocket.disconnect();
                isConnectedRef.current = false;
                console.log('WebSocket disconnected');
            }
        };
    }, [user]);

    const subscribe = React.useCallback((event, handler) => {
        websocket.on(event, handler);
        return () => websocket.off(event, handler);
    }, []);

    return (
        <WebSocketContext.Provider value={{ subscribe }}>
            {children}
        </WebSocketContext.Provider>
    );
};
