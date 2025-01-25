'use client';
import { useState, useEffect } from 'react';

export default function TestPage() {
  const [status, setStatus] = useState('Not connected');
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    console.log('Attempting WebSocket connection...');
    const ws = new WebSocket('ws://0.0.0.0:8000/ws');

    ws.onopen = () => {
      console.log('Connected!');
      setStatus('Connected');
      ws.send('Hello!');
    };

    ws.onmessage = (evt) => {
      console.log('Message received:', evt.data);
      setMessages(prev => [...prev, evt.data]);
    };

    ws.onerror = (evt) => {
      console.error('WebSocket error:', evt);
      setStatus('Error connecting');
    };

    ws.onclose = () => {
      console.log('Disconnected');
      setStatus('Disconnected');
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="p-4">
      <h1>WebSocket Test</h1>
      <p>Status: {status}</p>
      <div className="mt-4">
        <h2>Messages:</h2>
        {messages.map((msg, i) => (
          <pre key={i}>{msg}</pre>
        ))}
      </div>
    </div>
  );
}