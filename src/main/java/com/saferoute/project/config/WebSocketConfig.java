package com.saferoute.project.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable a simple in-memory broker for the /topic prefix
        // Clients subscribe to /topic/hazards to receive broadcasts
        config.enableSimpleBroker("/topic");

        // Prefix for messages FROM clients TO the server (@MessageMapping)
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Native WebSocket endpoint used by the React live-warning hook.
        registry.addEndpoint("/ws-native")
                .setAllowedOriginPatterns("http://localhost:5173", "http://localhost:3000");
        registry.addEndpoint("/ws")
                // Allow React dev server origin
                .setAllowedOriginPatterns("http://localhost:5173", "http://localhost:3000")
                // SockJS fallback for browsers that don't support native WebSocket
                .withSockJS();
    }
}
