package com.saferoute.project.repository;

import com.saferoute.project.model.AccidentRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AccidentRecordRepository extends JpaRepository<AccidentRecord, Long> {

    // Bounding box geo-query (used for blackspot map overlays)
    List<AccidentRecord> findByLatitudeBetweenAndLongitudeBetween(
            Double minLat, Double maxLat, Double minLon, Double maxLon);

    // Count by severity (used in admin stats)
    long countBySeverity(String severity);

    // Group severity counts for dashboard chart
    @Query("SELECT a.severity, COUNT(a) FROM AccidentRecord a GROUP BY a.severity")
    List<Object[]> countBySeverityGrouped();

    // Top blackspot locations (most accidents within ~250m radius, approximated)
    @Query(value = """
        SELECT location_name, COUNT(*) as cnt, AVG(latitude) as lat, AVG(longitude) as lon
        FROM accident_records
        WHERE location_name IS NOT NULL
        GROUP BY location_name
        ORDER BY cnt DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Object[]> findTopBlackspots(@Param("limit") int limit);

    // Accidents near a coordinate within bounding box
    @Query("""
        SELECT a FROM AccidentRecord a
        WHERE a.latitude BETWEEN :minLat AND :maxLat
        AND a.longitude BETWEEN :minLon AND :maxLon
        AND a.severity = 'HIGH'
        """)
    List<AccidentRecord> findHighSeverityNear(
            @Param("minLat") Double minLat, @Param("maxLat") Double maxLat,
            @Param("minLon") Double minLon, @Param("maxLon") Double maxLon);
}
