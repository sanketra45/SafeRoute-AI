package com.saferoute.project.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "accident_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AccidentRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    // LOW, MEDIUM, HIGH
    @Column(nullable = false)
    private String severity;

    // MORNING_PEAK, DAY, EVENING_PEAK, NIGHT
    @Column(nullable = false)
    private String timeOfDay;

    // CLEAR, RAIN, FOG, etc.
    @Column(nullable = false)
    private String weatherCondition;

    // RESIDENTIAL, MAIN_ROAD, HIGHWAY, etc.
    @Column(nullable = false)
    private String roadType;

    // LOW, MEDIUM, HIGH
    @Column(nullable = false)
    private String trafficDensity;

    private Integer historicalAccidentCount;

    private String locationName;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime recordedAt = LocalDateTime.now();
}
