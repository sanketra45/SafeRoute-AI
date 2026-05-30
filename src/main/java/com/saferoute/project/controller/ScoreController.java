package com.saferoute.project.controller;

import com.saferoute.project.dto.ScoreDto;
import com.saferoute.project.dto.ScoreEventDto;
import com.saferoute.project.service.ScoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/score")
@RequiredArgsConstructor
public class ScoreController {

    private final ScoreService scoreService;

    /**
     * GET /api/score/me
     * Returns the current user's driving score and grade.
     */
    @GetMapping("/me")
    public ResponseEntity<ScoreDto> getMyScore(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(scoreService.getScore(userDetails.getUsername()));
    }

    /**
     * GET /api/score/history
     * Returns the current user's score event history.
     */
    @GetMapping("/history")
    public ResponseEntity<List<ScoreEventDto>> getHistory(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(scoreService.getScoreHistory(userDetails.getUsername()));
    }

    /**
     * POST /api/score/event
     * Records a new score event (called by frontend when user traverses a risk zone).
     * Body: { "eventType": "HIGH_RISK_ZONE_TRAVERSAL", "riskLevel": "HIGH",
     *         "latitude": 21.14, "longitude": 79.08 }
     */
    @PostMapping("/event")
    public ResponseEntity<ScoreDto> recordEvent(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(scoreService.recordEvent(
                userDetails.getUsername(),
                (String) body.get("eventType"),
                (String) body.get("riskLevel"),
                body.get("latitude") != null ? ((Number) body.get("latitude")).doubleValue() : null,
                body.get("longitude") != null ? ((Number) body.get("longitude")).doubleValue() : null
        ));
    }
}
