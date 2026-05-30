package com.saferoute.project.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class HazardRequest {
    @NotNull private Double latitude;
    @NotNull private Double longitude;

    // POTHOLE | ACCIDENT | ROAD_CLOSURE | WATERLOGGING | DEBRIS
    @NotNull private String hazardType;

    private String description;
}
