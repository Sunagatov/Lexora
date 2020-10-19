package com.zufar.bookshelf.dao.user;

import com.zufar.bookshelf.dao.user.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    boolean existsByLogin(String login);

    User getByLoginAndPassword(String login, String password);

    User getByLogin(String login);
}
