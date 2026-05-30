package com.saferoute.project.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class HazardDto {
    private Long id;
    private Double latitude;
    private Double longitude;
    private String hazardType;
    private String description;
    private String reportedByName;
    private Integer upvotes;
    private String status;
    private LocalDateTime reportedAt;
}
