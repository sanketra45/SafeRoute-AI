package com.saferoute.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RiskRequest {
    @NotNull(message = "Latitude is required")
    private Double latitude;

    @NotNull(message = "Longitude is required")
    private Double longitude;

    // MORNING_PEAK | DAY | EVENING_PEAK | NIGHT
    @NotBlank(message = "Time of day is required")
    private String timeOfDay;

    // CLEAR | RAIN | FOG | CLOUDY
    private String weatherCondition;

    // LOW | MEDIUM | HIGH
    private String trafficDensity;

    // RESIDENTIAL | MAIN_ROAD | HIGHWAY
    private String roadType;
}
