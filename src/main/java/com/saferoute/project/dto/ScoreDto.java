package com.saferoute.project.dto;

import lombok.Data;

@Data
public class ScoreDto {
    private Long userId;
    private String userName;
    private Integer drivingScore;
    private Long totalEvents;
    private String scoreGrade;   // A, B, C, D based on score
}
