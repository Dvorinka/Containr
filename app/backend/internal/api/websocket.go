package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WebSocketClient struct {
	ID       string
	UserID   string
	Conn     *websocket.Conn
	Channels map[string]bool
	Send     chan []byte
}

type WebSocketMessage struct {
	Type      string      `json:"type"`
	Channel   string      `json:"channel"`
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
}

type WebSocketHub struct {
	clients    map[string]*WebSocketClient
	broadcast  chan *WebSocketMessage
	register   chan *WebSocketClient
	unregister chan *WebSocketClient
	mu         sync.RWMutex
}

var wsHub = &WebSocketHub{
	clients:    make(map[string]*WebSocketClient),
	broadcast:  make(chan *WebSocketMessage, 100),
	register:   make(chan *WebSocketClient),
	unregister: make(chan *WebSocketClient),
}

func init() {
	go wsHub.run()
}

func (h *WebSocketHub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			log.Printf("WebSocket client connected: %s", client.ID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.Send)
			}
			h.mu.Unlock()
			log.Printf("WebSocket client disconnected: %s", client.ID)

		case message := <-h.broadcast:
			h.mu.RLock()
			data, err := json.Marshal(message)
			if err != nil {
				log.Printf("Error marshaling WebSocket message: %v", err)
				h.mu.RUnlock()
				continue
			}

			for _, client := range h.clients {
				if client.Channels[message.Channel] || message.Channel == "all" {
					select {
					case client.Send <- data:
					default:
						close(client.Send)
						delete(h.clients, client.ID)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *WebSocketHub) Broadcast(channel string, msgType string, data interface{}) {
	message := &WebSocketMessage{
		Type:      msgType,
		Channel:   channel,
		Data:      data,
		Timestamp: time.Now(),
	}
	h.broadcast <- message
}

func (h *WebSocketHub) BroadcastToUser(userID string, msgType string, data interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	message := &WebSocketMessage{
		Type:      msgType,
		Channel:   "user:" + userID,
		Data:      data,
		Timestamp: time.Now(),
	}

	messageBytes, err := json.Marshal(message)
	if err != nil {
		return
	}

	for _, client := range h.clients {
		if client.UserID == userID {
			select {
			case client.Send <- messageBytes:
			default:
			}
		}
	}
}

func handleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		conn.Close()
		return
	}

	client := &WebSocketClient{
		ID:       generateClientID(),
		UserID:   userID.(string),
		Conn:     conn,
		Channels: make(map[string]bool),
		Send:     make(chan []byte, 256),
	}

	wsHub.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *WebSocketClient) readPump() {
	defer func() {
		wsHub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var msg struct {
			Action  string `json:"action"`
			Channel string `json:"channel"`
		}
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		switch msg.Action {
		case "subscribe":
			c.Channels[msg.Channel] = true
		case "unsubscribe":
			delete(c.Channels, msg.Channel)
		}

		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	}
}

func (c *WebSocketClient) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func generateClientID() string {
	return time.Now().Format("20060102150405") + "-" + randomString(8)
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().Nanosecond()%len(letters)]
	}
	return string(b)
}

func BroadcastServiceUpdate(serviceID string, data interface{}) {
	wsHub.Broadcast("service:"+serviceID, "service_update", data)
}

func BroadcastDeploymentUpdate(deploymentID string, data interface{}) {
	wsHub.Broadcast("deployment:"+deploymentID, "deployment_update", data)
}

func BroadcastBuildUpdate(buildID string, data interface{}) {
	wsHub.Broadcast("build:"+buildID, "build_update", data)
}

func BroadcastMetricsUpdate(serviceID string, data interface{}) {
	wsHub.Broadcast("metrics:"+serviceID, "metrics_update", data)
}

func BroadcastScalingEvent(serviceID string, data interface{}) {
	wsHub.Broadcast("scaling:"+serviceID, "scaling_event", data)
}

func NotifyUser(userID string, notificationType string, data interface{}) {
	wsHub.BroadcastToUser(userID, notificationType, data)
}
