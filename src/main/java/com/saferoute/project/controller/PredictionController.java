package com.saferoute.project.controller;

import com.saferoute.project.dto.RiskRequest;
import com.saferoute.project.dto.RiskResponse;
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
public class PredictionController {

    private final MlService mlService;

    /**
     * POST /api/predict-risk
     * Body: { "latitude": 21.14, "longitude": 79.08, "timeOfDay": "NIGHT",
     *         "weatherCondition": "RAIN", "trafficDensity": "HIGH", "roadType": "MAIN_ROAD" }
     * Returns: { "riskLevel": "HIGH", "confidence": 0.91, "message": "..." }
     *
     * Mirrors your Flask: POST /api/predict-risk
     */
    @PostMapping("/predict-risk")
    public ResponseEntity<RiskResponse> predictRisk(
            @Valid @RequestBody RiskRequest request) {
        return ResponseEntity.ok(mlService.predictRisk(request));
    }
}
