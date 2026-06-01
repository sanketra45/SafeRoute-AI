package com.saferoute.project.controller;

import com.saferoute.project.dto.AdminStatsDto;
import com.saferoute.project.model.ReportedHazard;
import com.saferoute.project.repository.AccidentRecordRepository;
import com.saferoute.project.repository.HazardRepository;
import com.saferoute.project.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminController {

    private final AccidentRecordRepository accidentRecordRepository;
    private final HazardRepository hazardRepository;
    private final UserRepository userRepository;

    /**
     * GET /api/admin/stats
     * City-wide safety analytics for the dashboard.
     */
    @GetMapping("/stats")
    public ResponseEntity<AdminStatsDto> getStats() {
        AdminStatsDto stats = new AdminStatsDto();
        stats.setTotalAccidents(accidentRecordRepository.count());
        stats.setTotalHazards(hazardRepository.count());
        stats.setActiveHazards(hazardRepository.countByStatus(ReportedHazard.HazardStatus.ACTIVE));
        stats.setTotalUsers(userRepository.count());

        // Map raw Object[] rows → typed SeverityCount
        stats.setSeverityCounts(
                accidentRecordRepository.countBySeverityGrouped().stream()
                        .map(AdminStatsDto.SeverityCount::new)
                        .toList()
        );

        // Map raw Object[] rows → typed Blackspot
        stats.setTopBlackspots(
                accidentRecordRepository.findTopBlackspots(10).stream()
                        .map(AdminStatsDto.Blackspot::new)
                        .toList()
        );

        return ResponseEntity.ok(stats);
    }

    /**
     * GET /api/admin/blackspots?minLat=&maxLat=&minLon=&maxLon=
     * Returns high-severity accident records within a bounding box.
     */
    @GetMapping("/blackspots")
    public ResponseEntity<?> getBlackspots(
            @RequestParam Double minLat, @RequestParam Double maxLat,
            @RequestParam Double minLon, @RequestParam Double maxLon) {
        return ResponseEntity.ok(
                accidentRecordRepository.findHighSeverityNear(minLat, maxLat, minLon, maxLon));
    }

    /**
     * GET /api/admin/users
     * List all registered users.
     */
    @GetMapping("/users")
    public ResponseEntity<?> getUsers() {
        return ResponseEntity.ok(userRepository.findAll().stream()
                .map(u -> Map.of(
                        "id", u.getId(),
                        "name", u.getName(),
                        "email", u.getEmail(),
                        "role", u.getRole(),
                        "drivingScore", u.getDrivingScore(),
                        "createdAt", u.getCreatedAt()
                )).toList());
    }
}
