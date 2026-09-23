// Connessione WebSocket con il Mac: riconnessione automatica e gestione del disabbinamento.

const CLOSE_UNPAIRED = 4001;

export function createConnection({ token, onMessage, onOpen, onClose, onUnpaired }) {
  let ws = null;
  let retryDelay = 1000;
  let stopped = false;

  function connect() {
    if (stopped || (ws && ws.readyState <= WebSocket.OPEN)) return;
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${scheme}://${location.host}/ws?t=${encodeURIComponent(token)}`);
    ws = socket;

    socket.onopen = () => {
      retryDelay = 1000;
      onOpen();
    };
    socket.onmessage = (ev) => onMessage(JSON.parse(ev.data));
    socket.onclose = (ev) => {
      if (ws !== socket) return;
      if (ev.code === CLOSE_UNPAIRED) {
        stopped = true;
        onUnpaired();
        return;
      }
      onClose();
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 15000);
    };
  }

  // Ping periodico: tiene viva la connessione quando lo schermo resta acceso a lungo.
  setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "ping" })), 25000);

  connect();
  return {
    connect,
    send(msg) {
      if (ws?.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(msg));
      return true;
    },
  };
}
