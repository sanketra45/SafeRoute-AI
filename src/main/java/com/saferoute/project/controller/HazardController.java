package com.saferoute.project.controller;

import com.saferoute.project.dto.*;
import com.saferoute.project.service.HazardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/hazards")
@RequiredArgsConstructor
public class HazardController {

    private final HazardService hazardService;

    /**
     * GET /api/hazards
     * Public. Returns all ACTIVE hazards for map load.
     */
    @GetMapping
    public ResponseEntity<List<HazardDto>> getAllHazards() {
        return ResponseEntity.ok(hazardService.getAllActiveHazards());
    }

    /**
     * POST /api/hazards
     * JWT required. Reports a new hazard AND broadcasts it via WebSocket.
     * Mirrors your Flask: POST /api/report-hazard + socketio.emit('new_hazard', ...)
     */
    @PostMapping
    public ResponseEntity<HazardDto> reportHazard(
            @Valid @RequestBody HazardRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
                hazardService.reportAndBroadcast(request, userDetails.getUsername()));
    }

    /**
     * PUT /api/hazards/{id}/upvote
     * JWT required. Community verification upvote.
     */
    @PutMapping("/{id}/upvote")
    public ResponseEntity<HazardDto> upvote(@PathVariable Long id) {
        return ResponseEntity.ok(hazardService.upvoteHazard(id));
    }

    /**
     * PUT /api/hazards/{id}/resolve
     * Admin only. Mark hazard as resolved.
     */
    @PutMapping("/{id}/resolve")
    public ResponseEntity<HazardDto> resolve(@PathVariable Long id) {
        return ResponseEntity.ok(hazardService.resolveHazard(id));
    }
}
