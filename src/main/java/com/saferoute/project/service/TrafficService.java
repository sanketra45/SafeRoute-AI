package com.saferoute.project.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class TrafficService {

    private final RestTemplate restTemplate;

    @Value("${traffic.api.key:}")
    private String apiKey;

    @Value("${traffic.api.url:https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json}")
    private String apiUrl;

    @SuppressWarnings("unchecked")
    public Map<String, Object> getTrafficFlow(Double lat, Double lon) {
        if (apiKey == null || apiKey.isBlank()) {
            // Return a mock response when no API key is configured
            return Map.of(
                    "currentSpeed", 40,
                    "freeFlowSpeed", 60,
                    "trafficDensity", "MEDIUM",
                    "description", "Traffic API key not configured",
                    "mock", true
            );
        }

        String url = UriComponentsBuilder.fromHttpUrl(apiUrl)
                .queryParam("point", lat + "," + lon)
                .queryParam("key", apiKey)
                .toUriString();

        try {
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            Map<String, Object> flow = response != null && response.get("flowSegmentData") instanceof Map
                    ? (Map<String, Object>) response.get("flowSegmentData") : Map.of();
            Number current = flow.get("currentSpeed") instanceof Number n ? n : 0;
            Number free = flow.get("freeFlowSpeed") instanceof Number n ? n : 0;
            double ratio = free.doubleValue() > 0 ? current.doubleValue() / free.doubleValue() : 1.0;
            String density = ratio < .45 ? "HIGH" : ratio < .75 ? "MEDIUM" : "LOW";
            return Map.of("currentSpeed", current, "freeFlowSpeed", free,
                    "trafficDensity", density, "mock", false);
        } catch (Exception e) {
            return Map.of("error", "Failed to fetch traffic: " + e.getMessage());
        }
    }
}
