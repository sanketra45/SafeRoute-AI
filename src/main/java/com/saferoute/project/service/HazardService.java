package com.saferoute.project.service;

import com.saferoute.project.dto.HazardDto;
import com.saferoute.project.dto.HazardRequest;
import com.saferoute.project.model.ReportedHazard;
import com.saferoute.project.model.User;
import com.saferoute.project.repository.HazardRepository;
import com.saferoute.project.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HazardService {

    private final HazardRepository hazardRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public List<HazardDto> getAllActiveHazards() {
        return hazardRepository.findByStatus(ReportedHazard.HazardStatus.ACTIVE)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public HazardDto reportAndBroadcast(HazardRequest request, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userEmail));

        ReportedHazard hazard = ReportedHazard.builder()
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .hazardType(ReportedHazard.HazardType.valueOf(request.getHazardType()))
                .description(request.getDescription())
                .reportedBy(user)
                .build();

        ReportedHazard saved = hazardRepository.save(hazard);
        HazardDto dto = toDto(saved);

        // Broadcast new hazard to all WebSocket subscribers
        messagingTemplate.convertAndSend("/topic/hazards", dto);

        return dto;
    }

    public HazardDto upvoteHazard(Long id) {
        ReportedHazard hazard = hazardRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Hazard not found: " + id));
        hazard.setUpvotes(hazard.getUpvotes() + 1);
        return toDto(hazardRepository.save(hazard));
    }

    public HazardDto resolveHazard(Long id) {
        ReportedHazard hazard = hazardRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Hazard not found: " + id));
        hazard.setStatus(ReportedHazard.HazardStatus.RESOLVED);
        return toDto(hazardRepository.save(hazard));
    }

    public void deleteHazard(Long id) {
        ReportedHazard hazard = hazardRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Hazard not found: " + id));
        hazardRepository.delete(hazard);
    }

    private HazardDto toDto(ReportedHazard h) {
        HazardDto dto = new HazardDto();
        dto.setId(h.getId());
        dto.setLatitude(h.getLatitude());
        dto.setLongitude(h.getLongitude());
        dto.setHazardType(h.getHazardType().name());
        dto.setDescription(h.getDescription());
        dto.setReportedByName(h.getReportedBy() != null ? h.getReportedBy().getName() : null);
        dto.setUpvotes(h.getUpvotes());
        dto.setStatus(h.getStatus().name());
        dto.setReportedAt(h.getReportedAt());
        return dto;
    }
}
