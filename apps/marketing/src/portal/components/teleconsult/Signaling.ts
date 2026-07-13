/**
 * WebRTC signaling client — browser side.
 *
 * Lifecycle:
 *   1. Caller constructs with the session metadata returned by
 *      GET /teleconsult/sessions/:id (iceServers + role + appointmentId).
 *   2. .start() opens the WS to /teleconsult/sessions/:id/ws — browser
 *      rides the portal_session cookie so no ticket is needed.
 *   3. DO pushes `{type: "hello"}` with peer list on connect. If the
 *      other peer is already in the room, the caller (the doctor in
 *      practice) generates an offer. If alone, the caller waits for
 *      `peer-joined` and only then offers.
 *   4. Both sides: polite-peer / glare-handling per the WebRTC spec.
 *      For 2-peer rooms glare is vanishingly rare but the guard is
 *      cheap.
 *   5. ICE candidates are batched (the standard trick) and forwarded.
 *
 * Media:
 *   - `getUserMedia({ video: true, audio: true })` — caller is
 *     responsible for surfacing the permission prompt.
 *   - `onRemoteStream` and `onLocalStream` are invoked exactly once
 *     each when the streams become available so the caller can attach
 *     them to <video> elements.
 *
 * Error handling:
 *   - All errors surfaced via `onError` (don't throw from callbacks).
 *   - Network drops auto-retry the WS handshake 3× with 1s/2s/4s backoff
 *     (mobile networks flap frequently).
 */

export type SignalingRole = "doctor" | "patient";

export interface SignalingOptions {
  sessionId: string;
  roomId: string;
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
const ICE_GATHERING_TIMEOUT_MS = 5000;

export class TeleconsultSignaling {
  private opts: SignalingOptions;
  private pc: RTCPeerConnection | null = null;
  private ws: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private reconnectAttempts = 0;
  private ended = false;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];
  private makingOffer = false;
  private ignoreOffer = false;

  constructor(opts: SignalingOptions) {
    this.opts = opts;
  }

  async start() {
    if (this.ended) return;
    this.opts.onStatus("connecting");
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
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
    const url = new URL(
      `/teleconsult/sessions/${encodeURIComponent(this.opts.sessionId)}/ws`,
      window.location.origin
    );
    // Same-origin so the portal_session cookie rides the upgrade.
    // API_URL may differ (e.g. dev), so honour it.
    const apiBase = this.opts.apiBase.replace(/\/$/, "");
    const wsBase = apiBase.startsWith("https")
      ? apiBase.replace(/^https/, "wss")
      : apiBase.replace(/^http/, "ws");
    const wsUrl = `${wsBase}${url.pathname}${url.search}`;
    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      this.scheduleReconnect(err);
      return;
    }
    this.ws.onopen = () => this.onWsOpen();
    this.ws.onmessage = (e) => this.onWsMessage(e);
    this.ws.onerror = () => {
      // Browsers fire onerror before onclose; onclose handles reconnect.
    };
    this.ws.onclose = (e) => this.onWsClose(e);
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

    this.localStream?.getTracks().forEach((track) => {
      this.pc!.addTrack(track, this.localStream!);
    });

    this.pc.ontrack = (e) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
        this.opts.onRemoteStream(this.remoteStream);
      }
      e.streams[0]?.getTracks().forEach((t) => this.remoteStream!.addTrack(t));
    };

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.send({ type: "ice", candidate: e.candidate });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState;
      if (state === "disconnected" || state === "failed") {
        this.opts.onStatus("reconnecting");
        // Try ICE restart as a recovery hint.
        try {
          this.pc?.restartIce();
        } catch {}
      } else if (state === "connected" || state === "completed") {
        this.opts.onStatus("connected");
      }
    };

    this.pc.onnegotiationneeded = async () => {
      try {
        if (!this.pc) return;
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        this.send({
          type: this.opts.role === "doctor" ? "offer" : "offer",
          sdp: this.pc.localDescription,
        });
      } catch (err) {
        this.opts.onError?.(
          err instanceof Error ? err : new Error("negotiation failed")
        );
      } finally {
        this.makingOffer = false;
      }
    };
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
        // If a peer is already present and we're the doctor (impolite),
        // kick off negotiation. Patients wait for the doctor to offer.
        if (msg.peers?.length > 0 && this.opts.role === "doctor") {
          // onnegotiationneeded fires automatically because tracks are
          // added before WS connect, but in case it didn't, force it.
          if (this.pc && this.pc.signalingState === "stable") {
            try {
              const offer = await this.pc.createOffer();
              await this.pc.setLocalDescription(offer);
              this.send({ type: "offer", sdp: this.pc.localDescription });
            } catch (err) {
              this.opts.onError?.(
                err instanceof Error ? err : new Error("createOffer failed")
              );
            }
          }
        }
        return;
      case "peer-joined":
        this.opts.onPeerJoined?.(msg.peer);
        // Doctor side: when a patient joins, trigger an offer so we
        // converge faster than relying on negotiationneeded.
        if (this.opts.role === "doctor" && this.pc && this.pc.signalingState === "stable") {
          try {
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
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
        try {
          this.pc?.restartIce();
        } catch {}
        return;
      case "ice-restart-hint":
        // Server-observed ICE gap; nudge a restart.
        try {
          this.pc?.restartIce();
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

  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    const offerCollision =
      this.makingOffer || this.pc.signalingState !== "stable";
    this.ignoreOffer = !this.opts.polite && offerCollision;
    if (this.ignoreOffer) return;
    await this.pc.setRemoteDescription(sdp);
    await this.pc.setLocalDescription();
    this.send({ type: "answer", sdp: this.pc.localDescription });
  }

  private async handleAnswer(sdp: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    if (this.pc.signalingState !== "have-local-offer") return;
    await this.pc.setRemoteDescription(sdp);
  }

  private async handleRemoteIce(candidate: RTCIceCandidateInit) {
    if (!this.pc || !candidate) return;
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (err) {
      if (!this.ignoreOffer) {
        this.opts.onError?.(
          err instanceof Error ? err : new Error("addIceCandidate failed")
        );
      }
    }
  }

  private send(msg: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(msg));
    } catch {}
  }

  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  setCameraOff(off: boolean) {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = !off));
  }

  private onWsClose(e: CloseEvent) {
    if (this.ended) return;
    if (e.code === 1008 || e.code === 1003 || e.code === 4401 || e.code === 4403) {
      // Policy/identity close — don't retry.
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
      this.ws?.close(1000, "user-end");
    } catch {}
    try {
      this.pc?.close();
    } catch {}
    try {
      this.localStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    this.localStream = null;
    this.remoteStream = null;
    this.pc = null;
    this.ws = null;
  }
}