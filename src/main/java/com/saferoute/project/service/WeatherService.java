package com.saferoute.project.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class WeatherService {

    private final RestTemplate restTemplate;

    @Value("${weather.api.key:}")
    private String apiKey;

    @Value("${weather.api.url:https://api.openweathermap.org/data/2.5/weather}")
    private String apiUrl;

    @SuppressWarnings("unchecked")
    public Map<String, Object> getCurrentWeather(Double lat, Double lon) {
        if (apiKey == null || apiKey.isBlank()) {
            // Return a mock response when no API key is configured
            return Map.of(
                    "weather", "CLEAR",
                    "temperature", 25.0,
                    "humidity", 60,
                    "description", "Weather API key not configured",
                    "mock", true
            );
        }

        String url = UriComponentsBuilder.fromHttpUrl(apiUrl)
                .queryParam("lat", lat)
                .queryParam("lon", lon)
                .queryParam("appid", apiKey)
                .queryParam("units", "metric")
                .toUriString();

        try {
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            String condition = "CLEAR";
            if (response != null && response.get("weather") instanceof java.util.List<?> weather
                    && !weather.isEmpty() && weather.get(0) instanceof Map<?, ?> first) {
                Object main = first.get("main");
                if (main != null) condition = main.toString().toUpperCase();
            }
            Map<String, Object> main = response != null && response.get("main") instanceof Map
                    ? (Map<String, Object>) response.get("main") : Map.of();
            return Map.of("condition", condition, "weather", condition,
                    "temperature", main.getOrDefault("temp", 0),
                    "humidity", main.getOrDefault("humidity", 0), "mock", false);
        } catch (Exception e) {
            return Map.of("error", "Failed to fetch weather: " + e.getMessage());
        }
    }
}
