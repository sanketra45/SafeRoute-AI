package com.saferoute.project.controller;

import com.saferoute.project.dto.AdminStatsDto;
import com.saferoute.project.model.AccidentRecord;
import com.saferoute.project.model.ReportedHazard;
import com.saferoute.project.model.User;
import com.saferoute.project.repository.AccidentRecordRepository;
import com.saferoute.project.repository.HazardRepository;
import com.saferoute.project.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminController {

    private final AccidentRecordRepository accidentRecordRepository;
    private final HazardRepository hazardRepository;
    private final UserRepository userRepository;

    // ─── Stats ───────────────────────────────────────────────────────

    @GetMapping("/stats")
    public ResponseEntity<AdminStatsDto> getStats() {
        AdminStatsDto stats = new AdminStatsDto();
        stats.setTotalAccidents(accidentRecordRepository.count());
        stats.setTotalHazards(hazardRepository.count());
        stats.setActiveHazards(hazardRepository.countByStatus(ReportedHazard.HazardStatus.ACTIVE));
        stats.setTotalUsers(userRepository.count());

        stats.setSeverityCounts(
                accidentRecordRepository.countBySeverityGrouped().stream()
                        .map(AdminStatsDto.SeverityCount::new)
                        .toList()
        );
        stats.setTopBlackspots(
                accidentRecordRepository.findTopBlackspots(10).stream()
                        .map(AdminStatsDto.Blackspot::new)
                        .toList()
        );
        return ResponseEntity.ok(stats);
    }

    // ─── User Management ─────────────────────────────────────────────

    @GetMapping("/users")
    public ResponseEntity<?> getUsers() {
        return ResponseEntity.ok(userRepository.findAll().stream()
                .map(u -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", u.getId());
                    m.put("name", u.getName());
                    m.put("email", u.getEmail());
                    m.put("role", u.getRole().name());
                    m.put("active", u.isActive());
                    m.put("createdAt", u.getCreatedAt());
                    return m;
                }).toList());
    }

    @PutMapping("/users/{id}/activate")
    public ResponseEntity<?> activateUser(@PathVariable Long id,
                                           @AuthenticationPrincipal UserDetails currentUser) {
        User target = findUserOrThrow(id);
        guardSelfRoleChange(target, currentUser);
        target.setActive(true);
        userRepository.save(target);
        return ResponseEntity.ok(Map.of("message", "User activated", "id", id));
    }

    @PutMapping("/users/{id}/deactivate")
    public ResponseEntity<?> deactivateUser(@PathVariable Long id,
                                             @AuthenticationPrincipal UserDetails currentUser) {
        User target = findUserOrThrow(id);
        guardSelfRoleChange(target, currentUser);
        target.setActive(false);
        userRepository.save(target);
        return ResponseEntity.ok(Map.of("message", "User deactivated", "id", id));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id,
                                         @AuthenticationPrincipal UserDetails currentUser) {
        User target = findUserOrThrow(id);
        guardSelfRoleChange(target, currentUser);
        userRepository.delete(target);
        return ResponseEntity.ok(Map.of("message", "User deleted", "id", id));
    }

    // ─── Blackspot Management (AccidentRecord = blackspot) ───────────

    @GetMapping("/blackspots")
    public ResponseEntity<?> getAllBlackspots() {
        return ResponseEntity.ok(accidentRecordRepository.findAll().stream()
                .map(this::blackspotToMap).toList());
    }

    @GetMapping("/blackspots/area")
    public ResponseEntity<?> getBlackspotsInArea(
            @RequestParam Double minLat, @RequestParam Double maxLat,
            @RequestParam Double minLon, @RequestParam Double maxLon) {
        return ResponseEntity.ok(
                accidentRecordRepository.findHighSeverityNear(minLat, maxLat, minLon, maxLon)
                        .stream().map(this::blackspotToMap).toList());
    }

    @PostMapping("/blackspots")
    public ResponseEntity<?> addBlackspot(@RequestBody Map<String, Object> body) {
        validateBlackspotBody(body);
        AccidentRecord record = AccidentRecord.builder()
                .latitude(toDouble(body.get("latitude")))
                .longitude(toDouble(body.get("longitude")))
                .severity(getString(body, "severity", "HIGH"))
                .timeOfDay(getString(body, "timeOfDay", "DAY"))
                .weatherCondition(getString(body, "weatherCondition", "CLEAR"))
                .roadType(getString(body, "roadType", "MAIN_ROAD"))
                .trafficDensity(getString(body, "trafficDensity", "MEDIUM"))
                .historicalAccidentCount(toInt(body.get("historicalAccidentCount"), 1))
                .locationName(getString(body, "locationName", "Unknown Location"))
                .build();
        AccidentRecord saved = accidentRecordRepository.save(record);
        return ResponseEntity.status(HttpStatus.CREATED).body(blackspotToMap(saved));
    }

    @PutMapping("/blackspots/{id}")
    public ResponseEntity<?> updateBlackspot(@PathVariable Long id,
                                              @RequestBody Map<String, Object> body) {
        AccidentRecord record = accidentRecordRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Blackspot not found: " + id));

        if (body.containsKey("latitude"))  record.setLatitude(toDouble(body.get("latitude")));
        if (body.containsKey("longitude")) record.setLongitude(toDouble(body.get("longitude")));
        if (body.containsKey("severity"))  record.setSeverity((String) body.get("severity"));
        if (body.containsKey("timeOfDay")) record.setTimeOfDay((String) body.get("timeOfDay"));
        if (body.containsKey("weatherCondition")) record.setWeatherCondition((String) body.get("weatherCondition"));
        if (body.containsKey("roadType"))  record.setRoadType((String) body.get("roadType"));
        if (body.containsKey("trafficDensity")) record.setTrafficDensity((String) body.get("trafficDensity"));
        if (body.containsKey("historicalAccidentCount"))
            record.setHistoricalAccidentCount(toInt(body.get("historicalAccidentCount"), record.getHistoricalAccidentCount()));
        if (body.containsKey("locationName")) record.setLocationName((String) body.get("locationName"));

        return ResponseEntity.ok(blackspotToMap(accidentRecordRepository.save(record)));
    }

    @DeleteMapping("/blackspots/{id}")
    public ResponseEntity<?> deleteBlackspot(@PathVariable Long id) {
        AccidentRecord record = accidentRecordRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Blackspot not found: " + id));
        accidentRecordRepository.delete(record);
        return ResponseEntity.ok(Map.of("message", "Blackspot deleted", "id", id));
    }

    // ─── Hazard Management ───────────────────────────────────────────

    @GetMapping("/hazards")
    public ResponseEntity<?> getAllHazards() {
        return ResponseEntity.ok(hazardRepository.findAll().stream()
                .map(this::hazardToMap).toList());
    }

    @PostMapping("/hazards")
    public ResponseEntity<?> addHazard(@RequestBody Map<String, Object> body) {
        if (body.get("latitude") == null || body.get("longitude") == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "latitude and longitude are required");
        }
        String hazardTypeStr = getString(body, "hazardType", "OTHER");
        ReportedHazard.HazardType hazardType;
        try {
            hazardType = ReportedHazard.HazardType.valueOf(hazardTypeStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            hazardType = ReportedHazard.HazardType.OTHER;
        }

        ReportedHazard hazard = ReportedHazard.builder()
                .latitude(toDouble(body.get("latitude")))
                .longitude(toDouble(body.get("longitude")))
                .hazardType(hazardType)
                .description(getString(body, "description", ""))
                .status(ReportedHazard.HazardStatus.ACTIVE)
                .build();
        ReportedHazard saved = hazardRepository.save(hazard);
        return ResponseEntity.status(HttpStatus.CREATED).body(hazardToMap(saved));
    }

    @PutMapping("/hazards/{id}")
    public ResponseEntity<?> updateHazard(@PathVariable Long id,
                                           @RequestBody Map<String, Object> body) {
        ReportedHazard hazard = hazardRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hazard not found: " + id));

        if (body.containsKey("latitude"))    hazard.setLatitude(toDouble(body.get("latitude")));
        if (body.containsKey("longitude"))   hazard.setLongitude(toDouble(body.get("longitude")));
        if (body.containsKey("description")) hazard.setDescription((String) body.get("description"));
        if (body.containsKey("hazardType")) {
            try {
                hazard.setHazardType(ReportedHazard.HazardType.valueOf(((String) body.get("hazardType")).toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }
        if (body.containsKey("status")) {
            try {
                hazard.setStatus(ReportedHazard.HazardStatus.valueOf(((String) body.get("status")).toUpperCase()));
            } catch (IllegalArgumentException ignored) {}
        }
        return ResponseEntity.ok(hazardToMap(hazardRepository.save(hazard)));
    }

    @DeleteMapping("/hazards/{id}")
    public ResponseEntity<?> deleteHazard(@PathVariable Long id) {
        ReportedHazard hazard = hazardRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hazard not found: " + id));
        hazardRepository.delete(hazard);
        return ResponseEntity.ok(Map.of("message", "Hazard deleted", "id", id));
    }

    @PutMapping("/hazards/{id}/resolve")
    public ResponseEntity<?> resolveHazard(@PathVariable Long id) {
        ReportedHazard hazard = hazardRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hazard not found: " + id));
        hazard.setStatus(ReportedHazard.HazardStatus.RESOLVED);
        return ResponseEntity.ok(hazardToMap(hazardRepository.save(hazard)));
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    private User findUserOrThrow(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));
    }

    private void guardSelfRoleChange(User target, UserDetails currentUser) {
        if (target.getEmail().equals(currentUser.getUsername()) &&
                target.getRole() == User.Role.ROLE_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Administrators cannot deactivate or delete their own admin account.");
        }
    }

    private void validateBlackspotBody(Map<String, Object> body) {
        if (body.get("latitude") == null || body.get("longitude") == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "latitude and longitude are required");
        }
    }

    private Map<String, Object> blackspotToMap(AccidentRecord r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("latitude", r.getLatitude());
        m.put("longitude", r.getLongitude());
        m.put("severity", r.getSeverity());
        m.put("timeOfDay", r.getTimeOfDay());
        m.put("weatherCondition", r.getWeatherCondition());
        m.put("roadType", r.getRoadType());
        m.put("trafficDensity", r.getTrafficDensity());
        m.put("historicalAccidentCount", r.getHistoricalAccidentCount());
        m.put("locationName", r.getLocationName());
        m.put("recordedAt", r.getRecordedAt());
        return m;
    }

    private Map<String, Object> hazardToMap(ReportedHazard h) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", h.getId());
        m.put("latitude", h.getLatitude());
        m.put("longitude", h.getLongitude());
        m.put("hazardType", h.getHazardType());
        m.put("severity", h.getSeverity());
        m.put("description", h.getDescription());
        m.put("upvotes", h.getUpvotes());
        m.put("status", h.getStatus());
        m.put("reportedAt", h.getReportedAt());
        return m;
    }

    private double toDouble(Object val) {
        if (val instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(val)); }
        catch (Exception e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid coordinate value: " + val); }
    }

    private int toInt(Object val, int def) {
        if (val == null) return def;
        if (val instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(val)); }
        catch (Exception e) { return def; }
    }

    private String getString(Map<String, Object> body, String key, String def) {
        Object val = body.get(key);
        return val != null ? String.valueOf(val) : def;
    }
}
