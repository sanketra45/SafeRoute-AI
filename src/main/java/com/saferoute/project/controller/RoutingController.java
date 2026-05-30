package com.saferoute.project.controller;

import com.saferoute.project.dto.RouteRequest;
import com.saferoute.project.dto.RouteResponse;
import com.saferoute.project.service.MlService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class RoutingController {

    private final MlService mlService;

    /**
     * POST /api/safe-route
     * Body: { "originLat": 21.14, "originLon": 79.08, "destLat": 21.15, "destLon": 79.09 }
     * Returns: { "safeRoute": [{lat, lon},...], "fastRoute": [...],
     *            "safeDistance": 2100.0, "fastDistance": 1800.0 }
     *
     * Delegates to Python ml_service.py /safe-route which runs the A* algorithm.
     */
    @PostMapping("/safe-route")
    public ResponseEntity<RouteResponse> getSafeRoute(
            @Valid @RequestBody RouteRequest request) {
        return ResponseEntity.ok(mlService.getSafeRoute(request));
    }
}
