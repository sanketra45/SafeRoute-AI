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

/**
 * Bridges Spring Boot → Python ML microservice.
 * The Python service is expected to run on ml.service.url (default: http://localhost:5000).
 */
@Service
@RequiredArgsConstructor
public class MlService {

    private final RestTemplate restTemplate;

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
            ResponseEntity<RouteResponse> response = restTemplate.exchange(
                    mlServiceUrl + "/safe-route",
                    HttpMethod.POST,
                    new HttpEntity<>(request, jsonHeaders()),
                    RouteResponse.class
            );
            RouteResponse body = response.getBody();
            if (body == null || (body.getSafeRoute() == null && body.getFastRoute() == null)) {
                throw new IllegalStateException("Routing service returned no route geometry");
            }
            return body;
        } catch (Exception e) {
            throw new IllegalStateException("Unable to calculate route: " + e.getMessage(), e);
        }
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }
}
