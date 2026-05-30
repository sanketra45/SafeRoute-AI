package com.saferoute.project.dto;

import lombok.Data;
import java.util.List;

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
}
