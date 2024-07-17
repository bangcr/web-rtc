import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";

type DrawData = {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
};

const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [peers, setPeers] = useState<Peer.Instance[]>([]);
  const [peerId, setPeerId] = useState<string | null>(null);
  const prevPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const p = new Peer({
      initiator: window.location.hash === "#1",
      trickle: false,
    });

    p.on("signal", (data) => {
      console.log(JSON.stringify(data));
      if (!peerId) {
        setPeerId(JSON.stringify(data));
      }
    });

    p.on("connect", () => {
      console.log("Peer connected");
      setPeers((prevPeers) => [...prevPeers, p]);
    });

    p.on("data", (data) => {
      const drawData: DrawData = JSON.parse(data.toString());
      drawOnCanvas(drawData);
    });

    return () => {
      p.destroy();
    };
  }, [peerId]);

  const drawOnCanvas = (data: DrawData) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(data.prevX, data.prevY);
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
      }
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      prevPos.current = { x, y };
    }
  };

  const stopDrawing = () => {
    setDrawing(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;

    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const data: DrawData = {
        x,
        y,
        prevX: prevPos.current.x,
        prevY: prevPos.current.y,
      };
      drawOnCanvas(data);
      peers.forEach((peer) => peer.send(JSON.stringify(data)));
      prevPos.current = { x, y };
    }
  };

  const handleConnect = (otherPeerId: string) => {
    const p = new Peer({ initiator: false, trickle: false });

    p.on("signal", (data) => {
      console.log("Signal received", JSON.stringify(data));
      p.signal(JSON.parse(otherPeerId));
    });

    p.on("connect", () => {
      console.log("Peer connected");
      setPeers((prevPeers) => [...prevPeers, p]);
    });

    p.on("data", (data) => {
      const drawData: DrawData = JSON.parse(data.toString());
      drawOnCanvas(drawData);
    });
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseMove={handleMouseMove}
        style={{ border: "1px solid black" }}
      />
      <div>
        <input
          type="text"
          placeholder="Enter peer ID"
          onBlur={(e) => handleConnect(e.target.value)}
        />
      </div>
      {peerId && <div>My Peer ID: {peerId}</div>}
    </div>
  );
};

export default Canvas;
