package com.saferoute.project.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import lombok.Data;

@Data
public class RouteRequest {
    @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") private Double originLat;
    @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") private Double originLon;
    @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") private Double destLat;
    @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") private Double destLon;
}
