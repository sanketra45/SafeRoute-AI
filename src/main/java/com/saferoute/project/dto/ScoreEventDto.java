package com.saferoute.project.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ScoreEventDto {
    private Long id;
    private String eventType;
    private Integer pointsDelta;
    private Integer scoreAfter;
    private String riskLevel;
    private Double latitude;
    private Double longitude;
    private String locationDescription;
    private LocalDateTime occurredAt;
}
