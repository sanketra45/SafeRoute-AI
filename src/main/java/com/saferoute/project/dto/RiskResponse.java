package com.saferoute.project.dto;

import lombok.Data;

@Data
public class RiskResponse {
    // HIGH | MEDIUM | LOW
    private String riskLevel;

    // 0.0 - 1.0
    private Double confidence;

    private String message;
}
