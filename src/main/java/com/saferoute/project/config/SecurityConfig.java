package com.saferoute.project.config;

import com.saferoute.project.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsService userDetailsService;
    private final CorsConfigurationSource corsConfigurationSource;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Enable CORS using the bean from AppConfig
                .cors(cors -> cors.configurationSource(corsConfigurationSource))

                // Disable CSRF (we use JWT, not sessions)
                .csrf(AbstractHttpConfigurer::disable)

                // Authorization rules
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints
                        .requestMatchers("/api/auth/**").permitAll()
                        // Public read for hazards (map display)
                        .requestMatchers(HttpMethod.GET, "/api/hazards").permitAll()
                        // External service proxies
                        .requestMatchers("/api/weather", "/api/traffic").permitAll()
                        // H2 console (dev only)
                        .requestMatchers("/h2-console/**").permitAll()
                        // WebSocket handshake
                        .requestMatchers("/ws/**").permitAll()

                        // Admin-only paths - MUST be server-side enforced
                        .requestMatchers("/api/admin/**").hasAuthority("ROLE_ADMIN")
                        // Hazard write/delete restricted to admin
                        .requestMatchers(HttpMethod.POST, "/api/hazards").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/hazards/*/resolve").hasAuthority("ROLE_ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/hazards/**").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/hazards/**").hasAuthority("ROLE_ADMIN")
                        // Everything else requires authentication
                        .anyRequest().authenticated()
                )

                // Stateless session (JWT, not HttpSession)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // Authentication provider
                .authenticationProvider(authenticationProvider())

                // Add JWT filter before the username/password filter
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }
}
