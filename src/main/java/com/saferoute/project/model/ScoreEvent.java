package com.saferoute.project.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "score_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScoreEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User user;

    // e.g. "HIGH_RISK_ZONE_TRAVERSAL", "HAZARD_REPORTED", "SAFE_ROUTE_USED"
    @Column(nullable = false)
    private String eventType;

    // negative = deduction, positive = reward
    @Column(nullable = false)
    private Integer pointsDelta;

    // Score after this event
    @Column(nullable = false)
    private Integer scoreAfter;

    // LOW, MEDIUM, HIGH
    private String riskLevel;

    private Double latitude;
    private Double longitude;
    private String locationDescription;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime occurredAt = LocalDateTime.now();
}
