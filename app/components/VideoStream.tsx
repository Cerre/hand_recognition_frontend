'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

// Define types for our hand data
interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface HandData {
  landmarks: Landmark[];
  bbox: {
    x_min: number;
    x_max: number;
    y_min: number;
    y_max: number;
  };
}

export const VideoStream = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [handData, setHandData] = useState<HandData[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const startCamera = () => {
    console.log('Starting camera...');
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(stream => {
        console.log('Camera started successfully');
        setStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error('Camera error:', err);
      });
  };

  const drawBoundingBoxes = useCallback((hands: HandData[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    hands.forEach((hand) => {
      const { bbox } = hand;
      const x = bbox.x_min * canvas.width;
      const y = bbox.y_min * canvas.height;
      const width = (bbox.x_max - bbox.x_min) * canvas.width;
      const height = (bbox.y_max - bbox.y_min) * canvas.height;

      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
    });
  }, []);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const updateCanvasSize = () => {
      if (canvasRef.current && video) {
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
      }
    };

    video.addEventListener('loadedmetadata', updateCanvasSize);
    return () => {
      video.removeEventListener('loadedmetadata', updateCanvasSize);
    };
  }, []);

  useEffect(() => {
    if (!stream) return;

    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://0.0.0.0:8081/ws';
    console.log('Attempting WebSocket connection...');
    console.log(WS_URL)
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket Connected Successfully');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setHandData(data.hands);
        if (data.hands && data.image_dims) {
          drawBoundingBoxes(data.hands);
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setIsConnected(false);
    };

    const currentStream = stream;
    return () => {
      console.log('Cleaning up...');
      currentStream.getTracks().forEach(track => track.stop());
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [stream, drawBoundingBoxes]);

  useEffect(() => {
    if (!isConnected || !videoRef.current || !wsRef.current) return;

    const intervalId = setInterval(() => {
      try {
        const canvas = document.createElement('canvas');
        const video = videoRef.current!;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        const base64Frame = canvas.toDataURL('image/jpeg;base64');
        wsRef.current!.send(base64Frame);
        
      } catch (error) {
        console.error('Error sending frame:', error);
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [isConnected]);

  return (
    <div className="flex flex-col items-center gap-4 border border-white-100 rounded-lg p-4 w-full max-w-[640px]">
      <div className="flex gap-4">
        {!stream ? (
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={startCamera}
          >
            Start Camera
          </button>
        ) : (
          <button 
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            onClick={() => {
              stream.getTracks().forEach(track => track.stop());
              setStream(null);
              if (wsRef.current) wsRef.current.close();
            }}
          >
            Stop Camera
          </button>
        )}
      </div>

      <div className="relative">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="-scale-x-100 w-full h-full rounded-lg"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ transform: 'scaleX(-1)' }}
        />
        <div className="absolute top-2 right-2">
          <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
      </div>

      {handData.length > 0 && (
        <div className="mt-4 p-4 bg-gray-800 rounded max-h-40 overflow-auto w-full">
          <div className="text-white text-sm mb-2">
            Detected Hands: {handData.length}
          </div>
          <div className="text-white text-xs">
            {handData.map((hand, index) => (
              <div key={index} className="mb-2">
                <div>Hand {index + 1}:</div>
                <div className="pl-2">
                  • Landmarks: {hand.landmarks.length}
                  <br />
                  • Position: {Math.round(hand.bbox.x_min * 100)}% - {Math.round(hand.bbox.y_min * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};