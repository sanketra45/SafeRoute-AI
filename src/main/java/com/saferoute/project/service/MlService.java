package com.saferoute.project.service;

import com.saferoute.project.dto.RiskRequest;
import com.saferoute.project.dto.RiskResponse;
import com.saferoute.project.dto.RouteRequest;
import com.saferoute.project.dto.RouteResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Bridges Spring Boot → Python ML microservice.
 * The Python service is expected to run on ml.service.url (default: http://localhost:5000).
 */
@Service
@RequiredArgsConstructor
public class MlService {

    private final RestTemplate restTemplate;
    private final TrafficService trafficService;
    private final WeatherService weatherService;

    @Value("${ml.service.url:http://localhost:5000}")
    private String mlServiceUrl;

    public RiskResponse predictRisk(RiskRequest request) {
        try {
            ResponseEntity<RiskResponse> response = restTemplate.exchange(
                    mlServiceUrl + "/predict-risk",
                    HttpMethod.POST,
                    new HttpEntity<>(request, jsonHeaders()),
                    RiskResponse.class
            );
            return response.getBody();
        } catch (Exception e) {
            // Fallback: return LOW risk when ML service is unavailable
            RiskResponse fallback = new RiskResponse();
            fallback.setRiskLevel("LOW");
            fallback.setConfidence(0.0);
            fallback.setMessage("ML service unavailable: " + e.getMessage());
            return fallback;
        }
    }

    public RouteResponse getSafeRoute(RouteRequest request) {
        try {
            // Fetch the providers on the server so keys never reach React, then
            // include their normalized values in the A* request.
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("originLat", request.getOriginLat());
            body.put("originLon", request.getOriginLon());
            body.put("destLat", request.getDestLat());
            body.put("destLon", request.getDestLon());
            body.put("traffic", trafficService.getTrafficFlow(request.getOriginLat(), request.getOriginLon()));
            body.put("weather", weatherService.getCurrentWeather(request.getOriginLat(), request.getOriginLon()));
            ResponseEntity<RouteResponse> response = restTemplate.exchange(
                    mlServiceUrl + "/safe-route",
                    HttpMethod.POST,
                    new HttpEntity<>(body, jsonHeaders()),
                    RouteResponse.class
            );
            return response.getBody();
        } catch (Exception e) {
            RouteResponse fallback = new RouteResponse();
            fallback.setMessage("ML service unavailable: " + e.getMessage());
            return fallback;
        }
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }
}
