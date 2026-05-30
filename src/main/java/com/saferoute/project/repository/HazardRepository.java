package com.saferoute.project.repository;

import com.saferoute.project.model.ReportedHazard;
import com.saferoute.project.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface HazardRepository extends JpaRepository<ReportedHazard, Long> {

    List<ReportedHazard> findByStatus(ReportedHazard.HazardStatus status);

    List<ReportedHazard> findByReportedByOrderByReportedAtDesc(User user);

    List<ReportedHazard> findByLatitudeBetweenAndLongitudeBetween(
            Double minLat, Double maxLat, Double minLon, Double maxLon);

    long countByStatus(ReportedHazard.HazardStatus status);
}
