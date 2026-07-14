/**
 * Mobile WebRTC signaling client — RN side.
 *
 * Mirrors the portal Signaling.ts contract (SignalingOptions / SignalingStatus)
 * but uses the `react-native-webrtc` polyfill and the WSS ticket flow
 * because RN WebSocket can't attach cookies from the SecureStore JWT
 * path. The portal-side client uses cookies; mobile uses tickets.
 *
 * Differences from portal client:
 *   - getUserMedia is imported from `react-native-webrtc`.
 *   - RTCPeerConnection is imported from `react-native-webrtc`.
 *   - Streams are attached to <RTCView> components (not <video>).
 *   - WS URL is built from the API URL swapped to `wss://`.
 *   - WS opens with `?ticket=<jwt>` rather than riding a cookie.
 */

let RTCPeerConnection: any = null;
let RTCSessionDescription: any = null;
let RTCIceCandidate: any = null;
let mediaDevices: any = null;
let MediaStream: any = null;

try {
  const webrtc = require("react-native-webrtc");
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  mediaDevices = webrtc.mediaDevices;
  MediaStream = webrtc.MediaStream;
} catch (e) {
  // Graceful fallback for Expo Go
}

export type SignalingRole = "doctor" | "patient";

export interface SignalingOptions {
  sessionId: string;
  ticket: string;
  apiBase: string;
  iceServers: RTCIceServer[];
  role: SignalingRole;
  polite: boolean;
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onStatus: (status: SignalingStatus) => void;
  onPeerJoined?: (info: { userId: string; role: string }) => void;
  onPeerLeft?: (info: { userId: string; role: string }) => void;
  onError?: (err: Error) => void;
  onEnded?: (payload: { status: string; reason?: string }) => void;
}

export type SignalingStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended"
  | "failed";

const MAX_RECONNECT_ATTEMPTS = 3;

export class TeleconsultSignaling {
  private opts: SignalingOptions;
  private pc: any = null;
  private ws: WebSocket | null = null;
  private localStream: any = null;
  private remoteStream: any = null;
  private reconnectAttempts = 0;
  private ended = false;
  private makingOffer = false;
  private ignoreOffer = false;

  constructor(opts: SignalingOptions) {
    this.opts = opts;
  }

  async start() {
    if (this.ended) return;
    this.opts.onStatus("connecting");
    try {
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: 1280,
          height: 720,
          frameRate: 30,
          facingMode: "user",
        },
      });
      this.opts.onLocalStream(this.localStream);
    } catch (err) {
      this.opts.onError?.(
        err instanceof Error ? err : new Error("getUserMedia failed")
      );
      this.opts.onStatus("failed");
      return;
    }
    this.openWebSocket();
  }

  private openWebSocket() {
    const apiBase = this.opts.apiBase.replace(/\/$/, "");
    const wsBase = apiBase.startsWith("https")
      ? apiBase.replace(/^https/, "wss")
      : apiBase.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/teleconsult/sessions/${encodeURIComponent(
      this.opts.sessionId
    )}/ws?ticket=${encodeURIComponent(this.opts.ticket)}`;

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      this.scheduleReconnect(err);
      return;
    }
    this.ws.onopen = () => this.onWsOpen();
    this.ws.onmessage = (e: MessageEvent) => this.onWsMessage(e);
    this.ws.onerror = () => {
      // Browsers fire onerror before onclose; onclose handles reconnect.
    };
    this.ws.onclose = (e: CloseEvent) => this.onWsClose(e);
  }

  private onWsOpen() {
    this.reconnectAttempts = 0;
    this.initPeerConnection();
    this.opts.onStatus("connected");
  }

  private initPeerConnection() {
    if (this.pc) return;
    this.pc = new RTCPeerConnection({
      iceServers: this.opts.iceServers,
    });

    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => {
        this.pc.addTrack(track, this.localStream);
      });
    }

    this.pc.addEventListener("track", (e: any) => {
      if (!this.remoteStream) {
        // react-native-webrtc exposes MediaStream from the same package.
        const Remote = require("react-native-webrtc").MediaStream;
        this.remoteStream = new Remote();
        this.opts.onRemoteStream(this.remoteStream);
      }
      try {
        e.streams[0].getTracks().forEach((t: any) => {
          this.remoteStream.addTrack(t);
        });
      } catch {}
    });

    this.pc.addEventListener("icecandidate", (e: any) => {
      if (e.candidate) {
        this.send({ type: "ice", candidate: e.candidate });
      }
    });

    this.pc.addEventListener("iceconnectionstatechange", () => {
      const state = this.pc?.iceConnectionState;
      if (state === "disconnected" || state === "failed") {
        this.opts.onStatus("reconnecting");
        try {
          this.pc.restartIce?.();
        } catch {}
      } else if (state === "connected" || state === "completed") {
        this.opts.onStatus("connected");
      }
    });

    this.pc.addEventListener("negotiationneeded", async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription(await this.pc.createOffer());
        this.send({ type: "offer", sdp: this.pc.localDescription });
      } catch (err) {
        this.opts.onError?.(
          err instanceof Error ? err : new Error("negotiation failed")
        );
      } finally {
        this.makingOffer = false;
      }
    });
  }

  private async onWsMessage(e: MessageEvent) {
    let msg: any;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== "string") return;

    switch (msg.type) {
      case "hello":
        if (msg.peers?.length > 0 && this.opts.role === "doctor") {
          if (this.pc && this.pc.signalingState === "stable") {
            try {
              await this.pc.setLocalDescription(await this.pc.createOffer());
              this.send({ type: "offer", sdp: this.pc.localDescription });
            } catch {}
          }
        }
        return;
      case "peer-joined":
        this.opts.onPeerJoined?.(msg.peer);
        if (this.opts.role === "doctor" && this.pc && this.pc.signalingState === "stable") {
          try {
            await this.pc.setLocalDescription(await this.pc.createOffer());
            this.send({ type: "offer", sdp: this.pc.localDescription });
          } catch {}
        }
        return;
      case "peer-left":
        this.opts.onPeerLeft?.(msg.peer);
        return;
      case "offer":
        await this.handleOffer(msg.sdp);
        return;
      case "answer":
        await this.handleAnswer(msg.sdp);
        return;
      case "ice":
        await this.handleRemoteIce(msg.candidate);
        return;
      case "ice-restart":
      case "ice-restart-hint":
        try {
          await this.pc?.restartIce?.();
        } catch {}
        return;
      case "end":
        this.ended = true;
        this.opts.onEnded?.({ status: msg.status, reason: msg.reason });
        this.opts.onStatus("ended");
        return;
      case "ping":
        this.send({ type: "pong", ts: Date.now() });
        return;
    }
  }

  private async handleOffer(sdp: any) {
    if (!this.pc) return;
    const offerCollision =
      this.makingOffer || this.pc.signalingState !== "stable";
    this.ignoreOffer = !this.opts.polite && offerCollision;
    if (this.ignoreOffer) return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      this.send({ type: "answer", sdp: this.pc.localDescription });
    } catch (err) {
      this.opts.onError?.(
        err instanceof Error ? err : new Error("offer/answer failed")
      );
    }
  }

  private async handleAnswer(sdp: any) {
    if (!this.pc) return;
    if (this.pc.signalingState !== "have-local-offer") return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch {}
  }

  private async handleRemoteIce(candidate: any) {
    if (!this.pc || !candidate) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {}
  }

  private send(msg: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(msg));
    } catch {}
  }

  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((t: any) => (t.enabled = !muted));
  }

  setCameraOff(off: boolean) {
    this.localStream?.getVideoTracks().forEach((t: any) => (t.enabled = !off));
  }

  private onWsClose(e: CloseEvent) {
    if (this.ended) return;
    if (e.code === 1008 || e.code === 1003 || e.code === 4401 || e.code === 4403) {
      this.opts.onStatus("failed");
      this.opts.onError?.(new Error(`Signaling closed: ${e.reason || e.code}`));
      return;
    }
    this.scheduleReconnect(new Error(`Signaling closed (${e.code})`));
  }

  private scheduleReconnect(err: any) {
    if (this.ended) return;
    this.opts.onError?.(err instanceof Error ? err : new Error("ws close"));
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.opts.onStatus("failed");
      return;
    }
    this.reconnectAttempts++;
    const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1);
    this.opts.onStatus("reconnecting");
    setTimeout(() => {
      if (!this.ended) this.openWebSocket();
    }, delay);
  }

  async end() {
    this.ended = true;
    try {
      this.send({ type: "bye" });
    } catch {}
    try {
      this.ws?.close();
    } catch {}
    try {
      this.pc?.close();
    } catch {}
    try {
      this.localStream?.getTracks().forEach((t: any) => t.stop());
    } catch {}
    this.localStream = null;
    this.remoteStream = null;
    this.pc = null;
    this.ws = null;
  }
}