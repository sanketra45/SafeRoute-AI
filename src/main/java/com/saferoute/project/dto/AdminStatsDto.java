package com.saferoute.project.dto;

import lombok.Data;
import java.util.List;

@Data
public class AdminStatsDto {
    private Long totalAccidents;
    private Long totalHazards;
    private Long activeHazards;
    private Long totalUsers;
    private List<Object[]> severityCounts;
    private List<Object[]> topBlackspots;
}
