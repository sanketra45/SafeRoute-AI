package com.saferoute.project;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.saferoute.project.model.User;
import com.saferoute.project.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:saferoute-test;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password="
})
@AutoConfigureMockMvc
class SecurityAuthorizationIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void cleanUsers() {
        userRepository.deleteAll();
    }

    @Test
    void userTokenCannotAccessAdministrativeOperations() throws Exception {
        String token = loginAs(User.Role.ROLE_USER, "user@example.com");

        mockMvc.perform(get("/api/admin/stats").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/hazards/1/resolve").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void authenticatedUserCanReportHazardAtSubmittedCoordinates() throws Exception {
        String token = loginAs(User.Role.ROLE_USER, "reporter@example.com");

        mockMvc.perform(post("/api/hazards")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"latitude":21.1458,"longitude":79.0882,"hazardType":"POTHOLE","severity":"HIGH","description":"Road damage"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.latitude").value(21.1458))
                .andExpect(jsonPath("$.longitude").value(79.0882))
                .andExpect(jsonPath("$.hazardType").value("POTHOLE"));
    }

    @Test
    void unauthenticatedUserCannotReportHazard() throws Exception {
        mockMvc.perform(post("/api/hazards")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"latitude":21.1458,"longitude":79.0882,"hazardType":"POTHOLE","severity":"HIGH"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void oversizedHazardDescriptionIsRejectedBeforePersistence() throws Exception {
        String token = loginAs(User.Role.ROLE_USER, "validation@example.com");
        String payload = "{\"latitude\":21.1458,\"longitude\":79.0882,\"hazardType\":\"POTHOLE\",\"description\":\"" + "x".repeat(501) + "\"}";

        mockMvc.perform(post("/api/hazards")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());
    }

    @Test
    void adminTokenCanAccessAdministrativeDashboard() throws Exception {
        String token = loginAs(User.Role.ROLE_ADMIN, "admin@example.com");

        mockMvc.perform(get("/api/admin/stats").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void adminBootstrapIsDisabledWithoutEnvironmentSecret() throws Exception {
        mockMvc.perform(post("/api/auth/init-admin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Admin\",\"email\":\"admin@example.com\",\"password\":\"password123\",\"secret\":\"anything\"}"))
                .andExpect(status().isForbidden());
    }

    private String loginAs(User.Role role, String email) throws Exception {
        userRepository.save(User.builder()
                .name(role == User.Role.ROLE_ADMIN ? "Admin" : "User")
                .email(email)
                .passwordHash(passwordEncoder.encode("password123"))
                .role(role)
                .active(true)
                .build());

        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode response = objectMapper.readTree(body);
        return response.get("token").asText();
    }
}
