'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { API_BASE_URL } from '@/lib/api';

interface PriceAlertContextType {
  clientId: string;
  notifications: string[];
  clearNotification: (index: number) => void;
  setAlert: (productId: string, targetPrice: number) => Promise<void>;
}

const PriceAlertContext = createContext<PriceAlertContextType | undefined>(undefined);

export function PriceAlertProvider({ children }: { children: React.ReactNode }) {
  const [clientId, setClientId] = useState('');
  const [notifications, setNotifications] = useState<string[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Generate a unique client ID if not exists
    let storedId = localStorage.getItem('price_alert_client_id');
    if (!storedId) {
      storedId = uuidv4();
      localStorage.setItem('price_alert_client_id', storedId);
    }
    setClientId(storedId);

    // Connect to WebSocket
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    const websocket = new WebSocket(`${wsUrl}/ws/alerts/${storedId}`);
    
    websocket.onmessage = (event) => {
      setNotifications((prev) => [...prev, event.data]);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  const clearNotification = (index: number) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  };

  const setAlert = async (productId: string, targetPrice: number) => {
    if (!clientId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          product_id: productId,
          target_price: targetPrice,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to set alert');
      }
    } catch (error) {
      console.error('Error setting alert:', error);
      throw error;
    }
  };

  return (
    <PriceAlertContext.Provider value={{ clientId, notifications, clearNotification, setAlert }}>
      {children}
      {/* Toast Notifications Overlay */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {notifications.map((msg, idx) => (
          <div key={idx} className="bg-indigo-600 text-white p-4 rounded shadow-lg flex items-center justify-between min-w-[300px]">
            <span>{msg}</span>
            <button onClick={() => clearNotification(idx)} className="text-white hover:text-gray-200 ml-4 font-bold">
              ×
            </button>
          </div>
        ))}
      </div>
    </PriceAlertContext.Provider>
  );
}

export function usePriceAlerts() {
  const context = useContext(PriceAlertContext);
  if (context === undefined) {
    throw new Error('usePriceAlerts must be used within a PriceAlertProvider');
  }
  return context;
}
