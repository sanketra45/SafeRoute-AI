package com.saferoute.project.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RouteRequest {
    @NotNull private Double originLat;
    @NotNull private Double originLon;
    @NotNull private Double destLat;
    @NotNull private Double destLon;
}
