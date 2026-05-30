package com.saferoute.project.service;

import com.saferoute.project.dto.ScoreDto;
import com.saferoute.project.dto.ScoreEventDto;
import com.saferoute.project.model.ScoreEvent;
import com.saferoute.project.model.User;
import com.saferoute.project.repository.ScoreEventRepository;
import com.saferoute.project.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScoreService {

    private final UserRepository userRepository;
    private final ScoreEventRepository scoreEventRepository;

    // Points awarded/deducted per event type
    private static final Map<String, Integer> EVENT_POINTS = Map.of(
            "HIGH_RISK_ZONE_TRAVERSAL", -10,
            "MEDIUM_RISK_ZONE_TRAVERSAL", -5,
            "LOW_RISK_ZONE_TRAVERSAL", -1,
            "HAZARD_REPORTED", 5,
            "SAFE_ROUTE_USED", 3
    );

    public ScoreDto getScore(String email) {
        User user = findUser(email);
        long totalEvents = scoreEventRepository.countByUser(user);

        ScoreDto dto = new ScoreDto();
        dto.setUserId(user.getId());
        dto.setUserName(user.getName());
        dto.setDrivingScore(user.getDrivingScore());
        dto.setTotalEvents(totalEvents);
        dto.setScoreGrade(gradeFor(user.getDrivingScore()));
        return dto;
    }

    public List<ScoreEventDto> getScoreHistory(String email) {
        User user = findUser(email);
        return scoreEventRepository.findByUserOrderByOccurredAtDesc(user)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ScoreDto recordEvent(String email, String eventType, String riskLevel,
                                Double latitude, Double longitude) {
        User user = findUser(email);

        int delta = EVENT_POINTS.getOrDefault(eventType, 0);
        int newScore = Math.max(0, Math.min(100, user.getDrivingScore() + delta));

        ScoreEvent event = ScoreEvent.builder()
                .user(user)
                .eventType(eventType)
                .pointsDelta(delta)
                .scoreAfter(newScore)
                .riskLevel(riskLevel)
                .latitude(latitude)
                .longitude(longitude)
                .build();

        scoreEventRepository.save(event);

        user.setDrivingScore(newScore);
        userRepository.save(user);

        return getScore(email);
    }

    private User findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }

    private String gradeFor(int score) {
        if (score >= 90) return "A";
        if (score >= 75) return "B";
        if (score >= 60) return "C";
        return "D";
    }

    private ScoreEventDto toDto(ScoreEvent e) {
        ScoreEventDto dto = new ScoreEventDto();
        dto.setId(e.getId());
        dto.setEventType(e.getEventType());
        dto.setPointsDelta(e.getPointsDelta());
        dto.setScoreAfter(e.getScoreAfter());
        dto.setRiskLevel(e.getRiskLevel());
        dto.setLatitude(e.getLatitude());
        dto.setLongitude(e.getLongitude());
        dto.setLocationDescription(e.getLocationDescription());
        dto.setOccurredAt(e.getOccurredAt());
        return dto;
    }
}
