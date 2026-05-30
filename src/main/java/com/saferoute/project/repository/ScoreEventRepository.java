package com.saferoute.project.repository;

import com.saferoute.project.model.ScoreEvent;
import com.saferoute.project.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ScoreEventRepository extends JpaRepository<ScoreEvent, Long> {

    List<ScoreEvent> findByUserOrderByOccurredAtDesc(User user);

    List<ScoreEvent> findTop10ByUserOrderByOccurredAtDesc(User user);

    long countByUser(User user);
}
