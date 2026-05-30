package com.saferoute.project.controller;

import com.saferoute.project.service.TrafficService;
import com.saferoute.project.service.WeatherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ProxyController {

    private final WeatherService weatherService;
    private final TrafficService trafficService;

    /**
     * GET /api/weather?lat=21.14&lon=79.08
     * Proxies OpenWeatherMap API - keeps API key server-side.
     * Mirrors your Flask: GET /api/weather
     */
    @GetMapping("/weather")
    public ResponseEntity<Map<String, Object>> getWeather(
            @RequestParam Double lat,
            @RequestParam Double lon) {
        return ResponseEntity.ok(weatherService.getCurrentWeather(lat, lon));
    }

    /**
     * GET /api/traffic?lat=21.14&lon=79.08
     * Proxies TomTom Traffic API - keeps API key server-side.
     * Mirrors your Flask: GET /api/traffic
     */
    @GetMapping("/traffic")
    public ResponseEntity<Map<String, Object>> getTraffic(
            @RequestParam Double lat,
            @RequestParam Double lon) {
        return ResponseEntity.ok(trafficService.getTrafficFlow(lat, lon));
    }
}
