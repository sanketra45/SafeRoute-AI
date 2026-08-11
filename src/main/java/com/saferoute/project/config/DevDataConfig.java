package com.saferoute.project.config;

import com.saferoute.project.model.User;
import com.saferoute.project.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

/** A predictable administrator for the local H2 demo profile only. */
@Configuration
@Profile("dev")
public class DevDataConfig {
    @Bean
    CommandLineRunner seedDevelopmentAdmin(UserRepository users, PasswordEncoder passwords) {
        return args -> {
            if (!users.existsByEmail("admin@saferoute.in")) {
                users.save(User.builder().name("System Admin").email("admin@saferoute.in")
                        .passwordHash(passwords.encode("Admin@123"))
                        .role(User.Role.ROLE_ADMIN).build());
            }
        };
    }
}
