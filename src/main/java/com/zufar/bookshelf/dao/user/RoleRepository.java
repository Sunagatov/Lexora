package com.zufar.bookshelf.dao.user;

import com.zufar.bookshelf.dao.user.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, Long> {
}
