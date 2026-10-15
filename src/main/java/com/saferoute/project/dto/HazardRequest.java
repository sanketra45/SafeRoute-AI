package com.saferoute.project.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class HazardRequest {
    @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") private Double latitude;
    @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") private Double longitude;

    // POTHOLE | ACCIDENT | ROAD_CLOSURE | WATERLOGGING | FLOODING | CONSTRUCTION | DEBRIS | OTHER
    @NotNull
    @Pattern(regexp = "POTHOLE|ACCIDENT|ROAD_CLOSURE|WATERLOGGING|FLOODING|CONSTRUCTION|DEBRIS|OTHER")
    private String hazardType;

    @Pattern(regexp = "LOW|MEDIUM|HIGH|CRITICAL")
    private String severity;

    @Size(max = 500, message = "Description must not exceed 500 characters")
    private String description;
}
