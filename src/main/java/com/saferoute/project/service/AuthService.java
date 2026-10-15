package com.saferoute.project.service;

import com.saferoute.project.dto.LoginRequest;
import com.saferoute.project.dto.LoginResponse;
import com.saferoute.project.dto.RegisterRequest;
import com.saferoute.project.dto.RegisterResponse;
import com.saferoute.project.model.User;
import com.saferoute.project.repository.UserRepository;
import com.saferoute.project.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Value("${admin.init.secret:}")
    private String adminInitSecret;

    public RegisterResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already in use: " + request.getEmail());
        }

        // Registration always assigns USER role — admin role must be assigned securely
        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(User.Role.ROLE_USER)
                .active(true)
                .build();

        User saved = userRepository.save(user);

        RegisterResponse response = new RegisterResponse();
        response.setUserId(saved.getId());
        response.setMessage("Registration successful. Welcome, " + saved.getName() + "!");
        return response;
    }

    public LoginResponse login(LoginRequest request) {
        // Performs credential validation + account lock check via UserDetailsService
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        UserDetails userDetails = userDetailsService.loadUserByUsername(request.getEmail());
        String token = jwtUtil.generateToken(userDetails);

        LoginResponse response = new LoginResponse();
        response.setToken(token);
        response.setUserId(user.getId());
        response.setName(user.getName());
        response.setEmail(user.getEmail());
        // Role returned from DB — never trusts client-supplied role
        response.setRole(user.getRole().name());
        return response;
    }

    /**
     * Initialise first admin account. Requires a server-side secret to prevent public misuse.
     * Set admin.init.secret in application.properties (or env variable ADMIN_INIT_SECRET).
     */
    public LoginResponse initAdmin(String name, String email, String password, String secret) {
        if (adminInitSecret == null || adminInitSecret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin initialization is disabled.");
        }
        if (!adminInitSecret.equals(secret)) {
            throw new IllegalArgumentException("Invalid admin init secret.");
        }
        if (email == null || email.isBlank() || password == null || password.length() < 6) {
            throw new IllegalArgumentException("A valid email and password of at least 6 characters are required.");
        }
        if (userRepository.existsByRole(User.Role.ROLE_ADMIN)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An administrator already exists.");
        }
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already in use: " + email);
        }

        User admin = User.builder()
                .name(name == null || name.isBlank() ? "System Admin" : name)
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .role(User.Role.ROLE_ADMIN)
                .active(true)
                .build();
        userRepository.save(admin);

        // Log in the new admin and return token
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, password)
        );
        User saved = userRepository.findByEmail(email).orElseThrow();
        UserDetails userDetails = userDetailsService.loadUserByUsername(email);
        String token = jwtUtil.generateToken(userDetails);

        LoginResponse response = new LoginResponse();
        response.setToken(token);
        response.setUserId(saved.getId());
        response.setName(saved.getName());
        response.setEmail(saved.getEmail());
        response.setRole(saved.getRole().name());
        return response;
    }
}
