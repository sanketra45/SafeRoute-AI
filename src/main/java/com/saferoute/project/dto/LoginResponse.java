package com.saferoute.project.dto;

import lombok.Data;

@Data
public class LoginResponse {
    private String token;
    private Long userId;
    private String name;
    private String email;
    private String role;
    private Integer drivingScore;
}
