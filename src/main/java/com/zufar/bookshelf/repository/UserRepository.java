package com.zufar.bookshelf.repository;

import com.zufar.bookshelf.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    boolean existsByLogin(String login);
    User getByLoginAndPassword(String login, String password);
    User getByLogin(String login);

}
