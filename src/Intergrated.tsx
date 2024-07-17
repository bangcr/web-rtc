import React, { useEffect, useRef, useState } from "react";
import { Socket, io } from "socket.io-client";
import Peer from "simple-peer";

const socket: Socket = io("https://dev-socket.classup.io");

type DrawData = {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
};

function Intergrated() {
  const [me, setMe] = useState<string>("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [receivingCall, setReceivingCall] = useState<boolean>(false);
  const [caller, setCaller] = useState<string>("");
  const [callerSignal, setCallerSignal] = useState<any>(null);
  const [callAccepted, setCallAccepted] = useState<boolean>(false);
  const [idToCall, setIdToCall] = useState<string>("");
  const [callEnded, setCallEnded] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const myVideo = useRef<HTMLVideoElement | null>(null);
  const userVideo = useRef<HTMLVideoElement | null>(null);
  const connectionRef = useRef<any>(null);
  const [peers, setPeers] = useState<Peer.Instance[]>([]); // 상태 추가

  useEffect(() => {
    navigator?.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setStream(stream);
        if (myVideo.current) {
          myVideo.current.srcObject = stream;
        }
      });

    socket.on("me", (id: string) => {
      setMe(id);
    });

    socket.on("callUser", (data: any) => {
      setReceivingCall(true);
      setCaller(data.from);
      setName(data.name);
      setCallerSignal(data.signal);
    });
  }, []);

  const callUser = (id: string) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      //@ts-ignore
      stream: stream,
    });
    peer.on("signal", (data) => {
      socket.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: me,
        name: name,
      });
    });
    peer.on("stream", (stream: MediaStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
    });
    socket.on("callAccepted", (signal: any) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    setPeers((prevPeers) => [...prevPeers, peer]); // 새로운 peer 추가
    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      //@ts-ignore
      stream: stream,
    });
    peer.on("signal", (data) => {
      socket.emit("answerCall", { signal: data, to: caller });
    });
    peer.on("stream", (stream: MediaStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
    });

    peer.on("data", (data) => {
      console.log("데이타 확인", data);

      const drawData: DrawData = JSON.parse(data.toString());
      drawOnCanvas(drawData);
    });

    peer.signal(callerSignal);
    setPeers((prevPeers) => [...prevPeers, peer]); // 새로운 peer 추가
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) {
      connectionRef.current.destroy();
    }
    setPeers([]); // 모든 peers 제거
  };

  //=====================================================================
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  //   const [peers, setPeers] = useState<Peer.Instance[]>([]);
  const [peerId, setPeerId] = useState<string | null>(null);
  const prevPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState(false);

  const drawOnCanvas = (data: DrawData) => {
    const canvas = canvasRef.current;
    console.log("드로우 온 캔바스", canvas);
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
    // console.log("스타트드로잉 캔바스", canvas);
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
    // console.log("마우스무브 캔바스", canvas);
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

  //   console.log("좌표", canvasRef.current);

  return (
    <>
      <h1 style={{ textAlign: "center", color: "#fff" }}>Zoomish</h1>
      <div className="container">
        <div className="video-container">
          <div className="video">
            {stream && (
              <video
                playsInline
                muted
                ref={myVideo}
                autoPlay
                style={{ width: "300px" }}
              />
            )}
          </div>
          <div className="video">
            {callAccepted && !callEnded ? (
              <video
                playsInline
                ref={userVideo}
                autoPlay
                style={{ width: "300px" }}
              />
            ) : null}
          </div>
        </div>
        <div className="myId">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginBottom: "20px" }}
          />
          {/* <button style={{ marginBottom: "2rem" }}>
            <button>Copy ID</button>
          </button>
          <span>ID: {me}</span> */}

          <CopyToClipboard text={me} style={{ marginBottom: "2rem" }}>
            <button>Copy ID</button>
          </CopyToClipboard>

          <input
            value={idToCall}
            onChange={(e) => setIdToCall(e.target.value)}
          />
          <div className="call-button">
            {callAccepted && !callEnded ? (
              <button color="secondary" onClick={leaveCall}>
                통화 종료
              </button>
            ) : (
              <button aria-label="call" onClick={() => callUser(idToCall)}>
                통화 시작
              </button>
            )}
            {idToCall}
          </div>
        </div>
        <div>
          {receivingCall && !callAccepted ? (
            <div className="caller">
              <h1>{name} is calling...</h1>
              <button onClick={answerCall}>Answer</button>
            </div>
          ) : null}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseMove={handleMouseMove}
        style={{ border: "1px solid black" }}
      />
    </>
  );
}

export default Intergrated;

const CopyToClipboard = ({ text, children }: any) => {
  const handleCopy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        alert("Copied to clipboard");
      })
      .catch((err) => {
        console.error("Could not copy text: ", err);
      });
  };

  return (
    <div
      onClick={handleCopy}
      style={{ display: "inline-block", cursor: "pointer" }}
    >
      {children}
    </div>
  );
};

// import React, { ReactElement, useEffect, useRef, useState } from "react";
// import { Socket, io } from "socket.io-client";
// import Peer from "simple-peer";

// const socket: Socket = io("https://dev-socket.classup.io");

// const Intergrated: React.FC = () => {
//   const [me, setMe] = useState<string>("");
//   const [stream, setStream] = useState<MediaStream | null>(null);
//   const [receivingCall, setReceivingCall] = useState<boolean>(false);
//   const [caller, setCaller] = useState<string>("");
//   const [callerSignal, setCallerSignal] = useState<any>(null);
//   const [callAccepted, setCallAccepted] = useState<boolean>(false);
//   const [idToCall, setIdToCall] = useState<string>("");
//   const [callEnded, setCallEnded] = useState<boolean>(false);
//   const [name, setName] = useState<string>("");
//   const myVideo = useRef<HTMLVideoElement | null>(null);
//   const userVideo = useRef<HTMLVideoElement | null>(null);
//   const connectionRef = useRef<any>(null);

//   // Whiteboard drawing state
//   const canvasRef = useRef<HTMLCanvasElement | null>(null);
//   const [peers, setPeers] = useState<Peer.Instance[]>([]);
//   const prevPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
//   const [drawing, setDrawing] = useState(false);

//   useEffect(() => {
//     navigator?.mediaDevices
//       ?.getUserMedia({ video: true, audio: true })
//       .then((stream) => {
//         setStream(stream);
//         if (myVideo.current) {
//           myVideo.current.srcObject = stream;
//         }
//       });

//     socket.on("me", (id: string) => {
//       setMe(id);
//     });

//     socket.on("callUser", (data: any) => {
//       setReceivingCall(true);
//       setCaller(data.from);
//       setName(data.name);
//       setCallerSignal(data.signal);
//     });

//     socket.on("callAccepted", (signal: any) => {
//       setCallAccepted(true);
//       if (connectionRef.current) {
//         connectionRef.current.signal(signal);
//       }
//     });

//     return () => {
//       socket.off("me");
//       socket.off("callUser");
//       socket.off("callAccepted");
//     };
//   }, []);

//   const callUser = (id: string) => {
//     const peer = new Peer({
//       initiator: true,
//       trickle: false,
//       //@ts-ignore
//       stream: stream,
//     });

//     peer.on("signal", (data) => {
//       socket.emit("callUser", {
//         userToCall: id,
//         signalData: data,
//         from: me,
//         name: name,
//       });
//     });

//     peer.on("stream", (stream: MediaStream) => {
//       if (userVideo.current) {
//         userVideo.current.srcObject = stream;
//       }
//     });

//     socket.on("callAccepted", (signal: any) => {
//       setCallAccepted(true);
//       peer.signal(signal);
//     });

//     connectionRef.current = peer;
//     setPeers((prevPeers) => [...prevPeers, peer]);
//   };

//   const answerCall = () => {
//     setCallAccepted(true);
//     const peer = new Peer({
//       initiator: false,
//       trickle: false,
//       //@ts-ignore
//       stream: stream,
//     });

//     peer.on("signal", (data) => {
//       socket.emit("answerCall", { signal: data, to: caller });
//     });

//     peer.on("stream", (stream: MediaStream) => {
//       if (userVideo.current) {
//         userVideo.current.srcObject = stream;
//       }
//     });

//     peer.signal(callerSignal);
//     connectionRef.current = peer;
//     setPeers((prevPeers) => [...prevPeers, peer]);
//   };

//   const leaveCall = () => {
//     setCallEnded(true);
//     if (connectionRef.current) {
//       connectionRef.current.destroy();
//     }
//     setPeers([]);
//   };

//   const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
//     setDrawing(true);
//     const canvas = canvasRef.current;
//     if (canvas) {
//       const rect = canvas.getBoundingClientRect();
//       const x = e.clientX - rect.left;
//       const y = e.clientY - rect.top;
//       prevPos.current = { x, y };
//     }
//   };

//   const stopDrawing = () => {
//     setDrawing(false);
//   };

//   const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
//     if (!drawing) return;

//     const canvas = canvasRef.current;
//     if (canvas) {
//       const rect = canvas.getBoundingClientRect();
//       const x = e.clientX - rect.left;
//       const y = e.clientY - rect.top;
//       const data = {
//         x,
//         y,
//         prevX: prevPos.current.x,
//         prevY: prevPos.current.y,
//       };

//       drawOnCanvas(data);
//       peers.forEach((peer) => peer.send(JSON.stringify(data)));
//       prevPos.current = { x, y };
//     }
//   };

//   const drawOnCanvas = (data: any) => {
//     const canvas = canvasRef.current;
//     if (canvas) {
//       const ctx = canvas.getContext("2d");
//       if (ctx) {
//         ctx.beginPath();
//         ctx.moveTo(data.prevX, data.prevY);
//         ctx.lineTo(data.x, data.y);
//         ctx.stroke();
//       }
//     }
//   };

//   return (
//     <>
//       <h1 style={{ textAlign: "center", color: "#fff" }}>Zoomish</h1>
//       <div className="container">
//         <div className="video-container">
//           <div className="video">
//             {stream && (
//               <video
//                 playsInline
//                 muted
//                 ref={myVideo}
//                 autoPlay
//                 style={{ width: "300px" }}
//               />
//             )}
//           </div>
//           <div className="video">
//             {callAccepted && !callEnded ? (
//               <video
//                 playsInline
//                 ref={userVideo}
//                 autoPlay
//                 style={{ width: "300px" }}
//               />
//             ) : null}
//           </div>
//         </div>
//         <div className="myId">
//           <input
//             value={name}
//             onChange={(e) => setName(e.target.value)}
//             style={{ marginBottom: "20px" }}
//           />
//           <CopyToClipboard text={me}>
//             <button>Copy ID</button>
//           </CopyToClipboard>
//           <input
//             value={idToCall}
//             onChange={(e) => setIdToCall(e.target.value)}
//           />
//           <div className="call-button">
//             {callAccepted && !callEnded ? (
//               <button color="secondary" onClick={leaveCall}>
//                 통화 종료
//               </button>
//             ) : (
//               <button onClick={() => callUser(idToCall)}>통화 시작</button>
//             )}
//             {idToCall}
//           </div>
//         </div>
//         <div>
//           {receivingCall && !callAccepted ? (
//             <div className="caller">
//               <h1>{name} is calling...</h1>
//               <button onClick={answerCall}>Answer</button>
//             </div>
//           ) : null}
//         </div>
//       </div>
//       {/* Whiteboard Canvas */}
//       <canvas
//         ref={canvasRef}
//         width={500}
//         height={500}
//         onMouseDown={startDrawing}
//         onMouseUp={stopDrawing}
//         onMouseMove={handleMouseMove}
//         style={{ border: "1px solid black", marginTop: "20px" }}
//       />
//     </>
//   );
// };

// const CopyToClipboard: React.FC<{ text: string; children: ReactElement }> = ({
//   text,
//   children,
// }) => {
//   const handleCopy = () => {
//     navigator.clipboard
//       .writeText(text)
//       .then(() => {
//         alert("Copied to clipboard");
//       })
//       .catch((err) => {
//         console.error("Could not copy text: ", err);
//       });
//   };

//   return (
//     <div
//       onClick={handleCopy}
//       style={{ display: "inline-block", cursor: "pointer" }}
//     >
//       {children}
//     </div>
//   );
// };

// export default Intergrated;
