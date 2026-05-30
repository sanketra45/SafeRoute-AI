package com.saferoute.project.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "reported_hazards")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReportedHazard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private HazardType hazardType;

    @Column(length = 500)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reported_by_user_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User reportedBy;

    @Builder.Default
    private Integer upvotes = 0;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private HazardStatus status = HazardStatus.ACTIVE;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime reportedAt = LocalDateTime.now();

    public enum HazardType {
        POTHOLE, ACCIDENT, ROAD_CLOSURE, WATERLOGGING, DEBRIS
    }

    public enum HazardStatus {
        ACTIVE, RESOLVED
    }
}
