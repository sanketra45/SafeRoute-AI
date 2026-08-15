package com.saferoute.project.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class RouteResponse {
    private List<Coordinate> safeRoute;
    private List<Coordinate> fastRoute;

    // in metres
    private Double safeDistance;
    private Double fastDistance;

    // average risk score (0-1) of all segments
    private Double safeRiskScore;
    private Double fastRiskScore;

    private String message;

    // Comparison stats from ML service (extra_distance_km, risk_reduction_pct, recommendation, etc.)
    private Map<String, Object> comparison;

    // Weather and traffic values that influenced this route calculation.
    private Map<String, Object> liveConditions;
}
