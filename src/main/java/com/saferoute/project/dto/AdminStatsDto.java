package com.saferoute.project.dto;

import lombok.Data;
import java.util.List;

@Data
public class AdminStatsDto {
    private Long totalAccidents;
    private Long totalHazards;
    private Long activeHazards;
    private Long totalUsers;

    // Severity → count breakdown, e.g. [{severity:"HIGH", count:42}, ...]
    private List<SeverityCount> severityCounts;

    // Top accident blackspots by location name
    private List<Blackspot> topBlackspots;

    @Data
    public static class SeverityCount {
        private String severity;
        private Long count;

        public SeverityCount(Object[] row) {
            this.severity = (String) row[0];
            this.count    = ((Number) row[1]).longValue();
        }
    }

    @Data
    public static class Blackspot {
        private String locationName;
        private Long   accidentCount;
        private Double latitude;
        private Double longitude;

        public Blackspot(Object[] row) {
            this.locationName   = (String) row[0];
            this.accidentCount  = ((Number) row[1]).longValue();
            this.latitude       = ((Number) row[2]).doubleValue();
            this.longitude      = ((Number) row[3]).doubleValue();
        }
    }
}
