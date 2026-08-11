import { useEffect, useState } from 'react'

// Minimal STOMP-over-native-WebSocket client. It subscribes to Spring's
// /topic/hazards without exposing any backend credentials in the browser.
export function useHazardSocket(onHazard) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let socket
    let retry
    let closed = false

    const connect = () => {
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${scheme}://${window.location.host}/ws-native`)
      socket.onopen = () => socket.send('CONNECT\naccept-version:1.2\nhost:localhost\n\n\0')
      socket.onmessage = ({ data }) => {
        const frame = String(data)
        if (frame.startsWith('CONNECTED')) {
          setConnected(true)
          socket.send('SUBSCRIBE\nid:hazard-alerts\ndestination:/topic/hazards\n\n\0')
          return
        }
        if (frame.startsWith('MESSAGE')) {
          const divider = frame.indexOf('\n\n')
          if (divider >= 0) {
            try { onHazard?.(JSON.parse(frame.slice(divider + 2).replace(/\0$/, ''))) } catch { /* ignore malformed frames */ }
          }
        }
      }
      socket.onclose = () => {
        setConnected(false)
        if (!closed) retry = window.setTimeout(connect, 3000)
      }
    }
    connect()
    return () => { closed = true; window.clearTimeout(retry); socket?.close() }
  }, [onHazard])

  return connected
}
