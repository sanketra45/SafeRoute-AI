package com.saferoute.project.controller;

import com.saferoute.project.dto.LoginRequest;
import com.saferoute.project.dto.LoginResponse;
import com.saferoute.project.dto.RegisterRequest;
import com.saferoute.project.dto.RegisterResponse;
import com.saferoute.project.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * POST /api/auth/register
     * Body: { "name": "Ashwini", "email": "a@a.com", "password": "secret123" }
     */
    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(
            @Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    /**
     * POST /api/auth/login
     * Body: { "email": "a@a.com", "password": "secret123" }
     * Returns: { "token": "eyJ...", "userId": 1, "role": "ROLE_USER", ... }
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
}
